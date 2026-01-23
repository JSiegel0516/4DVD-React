"""Download and convert NOAA Extended Reconstructed SST V5 datasets to Zarr format."""
import os
import pandas as pd
import requests
from tqdm import tqdm
from downloadftp import convert_nc_to_zarr, safe_filename


CSV_FILE = "Datasets.csv"
DOWNLOAD_DIR = "dataset"


def parse_dataset_hierarchy(dataset_name):
    """Parse DatasetName like 'NOAA|NOAA Extended Reconstructed SST V5|Surface|Long Term Mean' into folder path components."""
    if not dataset_name or pd.isna(dataset_name):
        return []
    return [part.strip() for part in str(dataset_name).split("|")]


def http_download(url: str, dest_path: str) -> str:
    """Download a file from HTTP/HTTPS with progress bar."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    try:
        print(f"⬇️ Downloading {url} -> {dest_path}")
        
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        # Get file size
        total_size = int(response.headers.get('content-length', 0))
        
        with open(dest_path, 'wb') as f:
            with tqdm(
                total=total_size,
                unit='B',
                unit_scale=True,
                unit_divisor=1024,
                desc=os.path.basename(dest_path)
            ) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))
        
        print(f"✅ Saved: {dest_path}")
        return dest_path
    
    except Exception as e:
        print(f"❌ Failed to download {url}: {e}")
        return ""


def main():
    df = pd.read_csv(CSV_FILE)
    
    # Filter for SST datasets (last two rows)
    sst_datasets = df[df['DatasetName'].str.contains('NOAA Extended Reconstructed SST V5', na=False)]
    
    print(f"Processing {len(sst_datasets)} SST datasets from {CSV_FILE}")
    print("-" * 80)
    
    downloaded_count = 0
    converted_count = 0
    
    for idx, row in sst_datasets.iterrows():
        url = str(row["OrigLocation"])
        if not url.startswith("http"):
            print(f"⏭️ Skipping non-HTTP URL: {url}")
            continue
        
        # Build hierarchical folder structure from DatasetName
        dataset_parts = parse_dataset_hierarchy(row.get("DatasetName", ""))
        if not dataset_parts:
            print(f"⚠️ No DatasetName for row {idx}, skipping")
            continue
        
        # Construct full path: dataset/NOAA/NOAA Extended Reconstructed SST V5/Surface/Long Term Mean/
        folder_path = os.path.join(DOWNLOAD_DIR, *[safe_filename(p) for p in dataset_parts])
        
        # Determine filename from URL
        filename = os.path.basename(url.rstrip("/"))
        dest_path = os.path.join(folder_path, filename)
        
        print(f"\n📦 Dataset: {row.get('DatasetName', 'Unknown')}")
        print(f"   URL: {url}")
        print(f"   Path: {dest_path}")
        
        # Download if not exists
        if os.path.exists(dest_path):
            print(f"⏭️ Already exists: {dest_path}")
        else:
            downloaded = http_download(url, dest_path)
            if downloaded:
                downloaded_count += 1
            else:
                continue
        
        # Convert to Zarr (sibling .zarr directory)
        if os.path.exists(dest_path):
            try:
                base, _ = os.path.splitext(dest_path)
                zarr_path = base + ".zarr"
                if os.path.exists(zarr_path):
                    print(f"⏭️ Zarr already exists: {zarr_path}")
                else:
                    print(f"🔄 Converting to Zarr: {zarr_path}")
                    convert_nc_to_zarr(dest_path, zarr_path, overwrite=False)
                    converted_count += 1
                    print(f"✅ Zarr created: {zarr_path}")
            except Exception as e:
                print(f"⚠️ Conversion failed for {dest_path}: {e}")
        
        print("-" * 80)
    
    print(f"\n✅ Summary: Downloaded {downloaded_count}, Converted {converted_count} to Zarr")


if __name__ == "__main__":
    main()
