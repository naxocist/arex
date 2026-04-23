"""
Cloud Storage Provider - Google Cloud Storage

Generic GCS client for uploading and managing files in Google Cloud Storage.
"""
from typing import Optional, List

from google.cloud import storage

from app.core.config import get_settings
settings = get_settings()


class CloudStorageClient:
    """
    Generic Google Cloud Storage client.

    Handles file uploads, downloads, and management.
    """

    def __init__(
        self,
        bucket_name: str = None,
        credentials_path: str = None
    ):
        """
        Initialize GCS client.

        Args:
            bucket_name: GCS bucket name (defaults to config).
            credentials_path: Path to service account JSON.
        """
        self.bucket_name = bucket_name or settings.gcs_bucket_name

        credentials_path = credentials_path or settings.service_account_json
        self._credentials = None
        if credentials_path:
            from google.oauth2 import service_account
            self._credentials = service_account.Credentials.from_service_account_file(credentials_path)

        self._client: Optional[storage.Client] = None
        self._bucket: Optional[storage.Bucket] = None

    @property
    def client(self) -> storage.Client:
        """Lazy load storage client."""
        if self._client is None:
            self._client = storage.Client(credentials=self._credentials)
        return self._client

    @property
    def bucket(self) -> storage.Bucket:
        """Lazy load bucket."""
        if self._bucket is None:
            self._bucket = self.client.bucket(self.bucket_name)
        return self._bucket

    def upload_bytes(
        self,
        data: bytes,
        destination_path: str,
        content_type: str = "application/octet-stream",
        make_public: bool = True,
        return_signed_url: bool = False
    ) -> str:
        """
        Upload bytes to GCS.

        Args:
            data: Bytes to upload.
            destination_path: Path in bucket (e.g., "charts/image.png").
            content_type: MIME type of the file.
            make_public: Whether to make the file publicly accessible (ignored for uniform bucket access).
            return_signed_url: If True, returns signed URL. If False, returns gcs_path.

        Returns:
            Signed URL or gcs_path depending on return_signed_url parameter.
        """
        blob = self.bucket.blob(destination_path)
        blob.upload_from_string(data, content_type=content_type)

        print(f"✅ Uploaded to GCS: {destination_path}")

        if return_signed_url:
            return self.get_signed_url(destination_path)
        else:
            return destination_path  # Return path only for database storage

    def upload_file(
        self,
        source_path: str,
        destination_path: str,
        content_type: str = None,
        make_public: bool = True,
        return_signed_url: bool = False
    ) -> str:
        """
        Upload file to GCS.

        Args:
            source_path: Local file path.
            destination_path: Path in bucket.
            content_type: Optional MIME type.
            make_public: Whether to make the file publicly accessible (ignored for uniform bucket access).
            return_signed_url: If True, returns signed URL. If False, returns gcs_path.

        Returns:
            Signed URL or gcs_path depending on return_signed_url parameter.
        """
        blob = self.bucket.blob(destination_path)
        blob.upload_from_filename(source_path, content_type=content_type)

        print(f"✅ Uploaded to GCS: {source_path} -> {destination_path}")

        if return_signed_url:
            return self.get_signed_url(destination_path)
        else:
            return destination_path  # Return path only for database storage

    def delete_blob(self, blob_path: str) -> bool:
        """
        Delete blob from GCS.

        Args:
            blob_path: Path to blob in bucket.

        Returns:
            True if deleted, False if not found.
        """
        blob = self.bucket.blob(blob_path)
        try:
            blob.delete()
            print(f"🗑️ Deleted from GCS: {blob_path}")
            return True
        except Exception:
            print(f"⚠️ Blob not found: {blob_path}")
            return False

    def get_public_url(self, blob_path: str) -> str:
        """
        Get public URL for a blob (using signed URL for uniform bucket access).

        Args:
            blob_path: Path to blob in bucket.

        Returns:
            Signed URL for access.
        """
        return self.get_signed_url(blob_path)

    def get_signed_url(self, blob_path: str, expiration_hours: int = 72) -> str:
        """
        Generate signed URL for blob access.

        Args:
            blob_path: Path to blob in bucket.
            expiration_hours: Hours until URL expires (default 72 hours).

        Returns:
            Signed URL for access.
        """
        from datetime import timedelta

        blob = self.bucket.blob(blob_path)
        try:
            signed_url = blob.generate_signed_url(
                expiration=timedelta(hours=expiration_hours),
                method="GET",
                version="v4",
                credentials=self._credentials,
            )
            print(f"✅ Generated signed URL for: {blob_path} (expires in {expiration_hours}h)")
            return signed_url
        except Exception as e:
            print(f"❌ Failed to generate signed URL: {e}")
            raise RuntimeError(f"Cannot generate signed URL for {blob_path}: {e}") from e

    def make_blob_public(self, blob_path: str) -> bool:
        """
        Generate new signed URL for existing blob (for uniform bucket access).

        Args:
            blob_path: Path to blob in bucket.

        Returns:
            True if successful, False if blob not found.
        """
        blob = self.bucket.blob(blob_path)
        try:
            if blob.exists():
                # For uniform bucket access, just generate signed URL
                signed_url = self.get_signed_url(blob_path)
                print(f"✅ Generated new signed URL for: {blob_path}")
                return True
            else:
                print(f"⚠️ Blob not found: {blob_path}")
                return False
        except Exception as e:
            print(f"❌ Failed to generate signed URL: {e}")
            return False

    def blob_exists(self, blob_path: str) -> bool:
        """Check if blob exists."""
        blob = self.bucket.blob(blob_path)
        return blob.exists()

    def list_blobs(self, prefix: str = None, suffix: str = None) -> list:
        """
        List blobs in bucket with optional prefix/suffix filter.

        Args:
            prefix: Filter blobs starting with this prefix (e.g., "summaries/").
            suffix: Filter blobs ending with this suffix (e.g., ".pdf").

        Returns:
            List of blob names matching the filters.
        """
        blobs = self.bucket.list_blobs(prefix=prefix)
        blob_names = []
        for blob in blobs:
            if suffix is None or blob.name.endswith(suffix):
                blob_names.append(blob.name)
        return blob_names

    def download_blob_to_bytes(self, blob_path: str) -> bytes:
        """
        Download blob content as bytes.

        Args:
            blob_path: Path to blob in bucket.

        Returns:
            Blob content as bytes.
        """
        blob = self.bucket.blob(blob_path)
        return blob.download_as_bytes()

    def download_all_as_zip(self, prefix: str = None, suffix: str = ".pdf", blob_paths: List[str] = None) -> bytes:
        """
        Download all matching blobs and return as zip bytes.

        Args:
            prefix: Filter blobs starting with this prefix.
            suffix: Filter blobs ending with this suffix (default ".pdf").
            blob_paths: Optional list of specific blob paths to download (overrides prefix/suffix).

        Returns:
            Zip file bytes containing all matching blobs.
        """
        import io
        import zipfile

        # Use provided paths or list from bucket
        if blob_paths:
            blob_names = blob_paths
        else:
            blob_names = self.list_blobs(prefix=prefix, suffix=suffix)

        # Custom ZipInfo class that properly handles UTF-8 filenames
        class UTF8ZipInfo(zipfile.ZipInfo):
            def _encodeFilenameFlags(self):
                # Always encode as UTF-8 and set the UTF-8 flag
                return self.filename.encode('utf-8'), self.flag_bits | 0x800

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for blob_name in blob_names:
                try:
                    content = self.download_blob_to_bytes(blob_name)
                    
                    # Use custom ZipInfo for UTF-8 support
                    info = UTF8ZipInfo(blob_name)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    
                    zip_file.writestr(info, content)
                    print(f"✅ Added to zip: {blob_name}")
                except Exception as e:
                    print(f"⚠️ Failed to download {blob_name}: {e}")

        zip_buffer.seek(0)
        return zip_buffer.getvalue()


# ==================== SINGLETON INSTANCE ====================

_instance: Optional[CloudStorageClient] = None


def get_storage_client(bucket_name: str = None) -> CloudStorageClient:
    """
    Get singleton client instance.

    Args:
        bucket_name: Optional bucket name override.

    Returns:
        CloudStorageClient instance.
    """
    global _instance
    if _instance is None:
        _instance = CloudStorageClient(bucket_name=bucket_name)
    return _instance


# ==================== CONVENIENCE FUNCTIONS ====================

def upload_image(data: bytes, path: str) -> str:
    """Upload image bytes to GCS."""
    return get_storage_client().upload_bytes(data, path, "image/png")


def delete_image(path: str) -> bool:
    """Delete image from GCS."""
    return get_storage_client().delete_blob(path)

def upload_local_file(local_path: str, cloud_path: str) -> str:
    """Upload existing file from disk."""
    return get_storage_client().upload_file(local_path, cloud_path)
