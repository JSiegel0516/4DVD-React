"""Download and convert first 10 datasets from Datasets.csv to Zarr format."""
import os
import pandas as pd
from downloadftp import ftp_download, convert_nc_to_zarr, safe_filename

CSV_FILE = "Datasets.csv"
DOWNLOAD_DIR = "dataset"
MAX_DOWNLOADS = 10


def parse_dataset_hierarchy(dataset_name):
    """Parse DatasetName like 'NOAA|GPCP V2.3 Precipitation|Single Level|Monthly Mean (Surface)' into folder path components."""
    if not dataset_name or pd.isna(dataset_name):
        return []
    return [part.strip() for part in str(dataset_name).split("|")]


def main():
    df = pd.read_csv(CSV_FILE)
    
    # Take first 10 rows
    subset = df.head(MAX_DOWNLOADS)
    print(f"Processing first {len(subset)} datasets from {CSV_FILE}")
    
    downloaded_count = 0
    converted_count = 0
    
    for idx, row in subset.iterrows():
        url = str(row["OrigLocation"])
        if not url.startswith("ftp://"):
            print(f"⏭️ Skipping non-FTP URL: {url}")
            continue
        
        # Build hierarchical folder structure from DatasetName (full path)
        dataset_parts = parse_dataset_hierarchy(row.get("DatasetName", ""))
        if not dataset_parts:
            print(f"⚠️ No DatasetName for row {idx}, skipping")
            continue
        
        # Construct full path: dataset/Source/Dataset/Level/Statistic/
        folder_path = os.path.join(DOWNLOAD_DIR, *[safe_filename(p) for p in dataset_parts])
        
        # Determine filename from URL or from CSV
        filename = os.path.basename(url.rstrip("/"))
        if not filename or filename == "":
            filename = safe_filename(f"{statistic}.nc")
        
        dest_path = os.path.join(folder_path, filename)
        
        # Skip if already exists
        if os.path.exists(dest_path):
            print(f"⏭️ Already exists: {dest_path}")
        else:
            downloaded = ftp_download(url, dest_path)
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
                    convert_nc_to_zarr(dest_path, zarr_path, overwrite=False)
                    converted_count += 1
            except Exception as e:
                print(f"⚠️ Conversion failed for {dest_path}: {e}")
    
    print(f"\n✅ Summary: Downloaded {downloaded_count}, Converted {converted_count} to Zarr")


if __name__ == "__main__":
    main()
