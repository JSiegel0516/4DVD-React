import os
import time
from typing import Dict, Optional, Union

import pandas as pd
import importlib
import xarray as xr
from urllib.parse import urlparse
from ftplib import FTP, error_perm, all_errors
from tqdm import tqdm  # pip install tqdm

CSV_FILE = "Datasets.csv"
DOWNLOAD_DIR = "dataset"


def safe_filename(name: str) -> str:
    """Convert text into a safe filename."""
    return "".join(c if c.isalnum() or c in "._- ()" else "_" for c in name)


def ftp_download(url: str, dest_path: str, *, max_retries: int = 3, retry_delay_seconds: int = 3) -> str:
    """Download a file from FTP with progress bar."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    url = str(url).strip()
    parsed = urlparse(url)

    if parsed.scheme != "ftp":
        print(f"❌ Skipping non-FTP URL: {url}")
        return ""

    host = parsed.hostname
    filepath = (parsed.path or "").strip()
    if not filepath.startswith("/"):
        filepath = "/" + filepath

    if not host or not filepath or filepath == "/":
        print(f"❌ Invalid FTP URL path: {url}")
        return ""

    last_error = None
    for attempt in range(1, max_retries + 1):
        pbar = None
        try:
            with FTP(host) as ftp:
                ftp.login()  # anonymous login

                # Try to get file size for progress bar and early missing-file signal.
                try:
                    total_size = ftp.size(filepath)
                except error_perm as pe:
                    if "550" in str(pe):
                        print(f"❌ Remote file missing/unavailable (550): {url}")
                        return ""
                    total_size = None
                except Exception:
                    total_size = None

                print(f"⬇️ Downloading {url} -> {dest_path} (attempt {attempt}/{max_retries})")

                with open(dest_path, "wb") as f:
                    pbar = tqdm(
                        total=total_size,
                        unit="B",
                        unit_scale=True,
                        unit_divisor=1024,
                        desc=os.path.basename(dest_path),
                        leave=True,
                    )

                    def callback(chunk):
                        f.write(chunk)
                        pbar.update(len(chunk))

                    ftp.retrbinary(f"RETR {filepath}", callback)

            # Validate that we downloaded a non-empty file.
            try:
                size = os.path.getsize(dest_path)
            except OSError:
                size = 0
            if size <= 0:
                try:
                    os.remove(dest_path)
                except OSError:
                    pass
                print(f"❌ Downloaded empty file, skipping: {dest_path}")
                return ""

            print(f"✅ Saved: {dest_path}")
            return dest_path

        except error_perm as e:
            last_error = e
            if "550" in str(e):
                print(f"❌ Remote file missing/unavailable (550): {url}")
                return ""
            # Other permanent FTP errors are unlikely to succeed on retry.
            print(f"❌ Failed to download {url}: {e}")
            return ""
        except all_errors as e:
            last_error = e
            # Remove partially written files so retries start cleanly.
            try:
                if os.path.exists(dest_path):
                    os.remove(dest_path)
            except OSError:
                pass

            if attempt >= max_retries:
                break

            sleep_seconds = retry_delay_seconds * (2 ** (attempt - 1))
            print(f"⚠️ FTP transfer failed ({e}). Retrying in {sleep_seconds}s...")
            time.sleep(sleep_seconds)
        finally:
            if pbar is not None:
                pbar.close()

    print(f"❌ Failed to download {url} after {max_retries} attempts: {last_error}")
    return ""


def convert_nc_to_zarr(
    nc_path: str,
    zarr_path: Optional[str] = None,
    *,
    chunks: Union[str, Dict[str, int]] = "auto",
    overwrite: bool = False,
    consolidate_metadata: bool = True,
) -> str:
    """Convert a NetCDF (.nc) file to a local Zarr store.

    Args:
        nc_path: Path to the input .nc file.
        zarr_path: Output Zarr store path (directory ending with .zarr). If not provided,
                   uses the same base name as `nc_path` with a .zarr suffix.
        chunks: Chunking strategy for xarray (e.g., "auto" or dict per dimension).
        overwrite: If True, remove existing store before writing.
        consolidate_metadata: If True, produce consolidated Zarr metadata (.zmetadata).

    Returns:
        The path to the created Zarr store.
    """
    if not os.path.isfile(nc_path):
        raise FileNotFoundError(f"Input .nc file not found: {nc_path}")

    if zarr_path is None:
        base, _ = os.path.splitext(nc_path)
        zarr_path = base + ".zarr"

    if os.path.exists(zarr_path):
        if overwrite:
            print(f"♻️ Overwriting existing Zarr store: {zarr_path}")
            # Safely remove existing directory
            if os.path.isdir(zarr_path):
                # Remove directory tree
                import shutil

                shutil.rmtree(zarr_path)
            else:
                os.remove(zarr_path)
        else:
            print(f"⏭️ Skipping, Zarr store already exists: {zarr_path}")
            return zarr_path

    os.makedirs(os.path.dirname(zarr_path) or ".", exist_ok=True)

    # Fast fail for empty/corrupt downloads before xarray/netCDF parsing.
    if os.path.getsize(nc_path) <= 0:
        raise ValueError(f"Input .nc file is empty: {nc_path}")

    print(f"🧪 Converting to Zarr: {nc_path} -> {zarr_path}")
    try:
        try:
            importlib.import_module("zarr")
        except ImportError as ie:
            raise RuntimeError(
                "Required dependency 'zarr' is not installed. Install it via 'pip install zarr'."
            ) from ie

        # Some datasets have non-standard time metadata; fall back to
        # decode_times=False when CF decoding fails.
        open_attempts = [
            {"decode_times": True, "use_cftime": True},
            {"decode_times": False},
        ]

        ds = None
        open_error = None
        for open_kwargs in open_attempts:
            try:
                ds = xr.open_dataset(nc_path, engine="netcdf4", chunks=chunks, **open_kwargs)
                break
            except Exception as e:
                open_error = e

        if ds is None:
            raise RuntimeError(f"Unable to open NetCDF dataset: {open_error}")

        try:
            # Write to Zarr
            ds.to_zarr(zarr_path, mode="w")
        finally:
            ds.close()

        # Optionally consolidate metadata for faster multi-file opening
        if consolidate_metadata:
            try:
                zarr_lib = importlib.import_module("zarr")
                zarr_lib.consolidate_metadata(zarr_path)
            except ImportError:
                print("⚠️ 'zarr' not installed; skipping metadata consolidation. Install via 'pip install zarr' to enable.")
            except Exception as ce:
                print(f"⚠️ Metadata consolidation failed for {zarr_path}: {ce}")
        print(f"✅ Zarr written: {zarr_path}")
        return zarr_path
    except Exception as e:
        print(f"❌ Failed converting {nc_path} to Zarr: {e}")
        raise


def convert_all_nc_under(root_dir: str = DOWNLOAD_DIR, *, overwrite: bool = False) -> None:
    """Find all .nc files under a directory tree and convert each to Zarr.

    Args:
        root_dir: Directory to search recursively for .nc files.
        overwrite: If True, overwrite existing .zarr stores.
    """
    count = 0
    for dirpath, _, filenames in os.walk(root_dir):
        for name in filenames:
            if name.lower().endswith(".nc"):
                nc_path = os.path.join(dirpath, name)
                try:
                    convert_nc_to_zarr(nc_path, overwrite=overwrite)
                    count += 1
                except Exception:
                    # Error already logged in convert function
                    continue
    print(f"🔎 Conversion completed. Processed {count} NetCDF file(s) under '{root_dir}'.")


def main():
    df = pd.read_csv(CSV_FILE)

    # Only rows where FTP_Working == True
    valid_rows = df[df["FTP_Working"] == True]
    print(f"Found {len(valid_rows)} working FTP links.")

    for _, row in valid_rows.iterrows():
        url = str(row["OrigLocation"])
        if not url.startswith("ftp://"):
            continue

        # Folder structure
        dataset_folder = safe_filename(row["DatasetName"].split("|")[1].strip() if "|" in row["DatasetName"] else row["DatasetName"])
        layer_folder = safe_filename(row["layerName"])
        stat_folder = safe_filename(f"{row['Statistic']} ({row['Levels']})")

        dest_dir = os.path.join(DOWNLOAD_DIR, dataset_folder, layer_folder, stat_folder)

        # File name from Statistic + Levels
        file_name = safe_filename(f"{row['Statistic']} ({row['Levels']}).nc")
        dest_path = os.path.join(dest_dir, file_name)

        # Skip if exists
        if os.path.exists(dest_path):
            print(f"⏭️ Skipping {dest_path}, already exists.")
            continue

        downloaded = ftp_download(url, dest_path)

        # Optionally auto-convert any newly downloaded .nc file to Zarr.
        # Toggle via environment variable: set AUTO_CONVERT_TO_ZARR=1 to enable.
        if downloaded and os.environ.get("AUTO_CONVERT_TO_ZARR", "0") == "1":
            try:
                convert_nc_to_zarr(downloaded, overwrite=os.environ.get("ZARR_OVERWRITE", "0") == "1")
            except Exception:
                # Already logged within convert function
                pass


if __name__ == "__main__":
    # If user wants to bulk-convert any existing .nc files in DOWNLOAD_DIR, set
    # CONVERT_EXISTING_NC_TO_ZARR=1 (optionally ZARR_OVERWRITE=1) before running.
    if os.environ.get("CONVERT_EXISTING_NC_TO_ZARR", "0") == "1":
        convert_all_nc_under(DOWNLOAD_DIR, overwrite=os.environ.get("ZARR_OVERWRITE", "0") == "1")
    else:
        main()
