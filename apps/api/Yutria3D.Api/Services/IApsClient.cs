namespace Yutria3D.Api.Services;

public interface IApsClient
{
    Task EnsureBucketAsync(string bucketKey, CancellationToken ct = default);
    Task<string> SignedS3UploadAsync(Stream content, string bucketKey, string objectKey, CancellationToken ct = default);
    Task StartTranslationAsync(string objectId, CancellationToken ct = default);
    Task<string?> GetManifestAsync(string urn, CancellationToken ct = default);
    Task DeleteObjectAsync(string bucketKey, string objectKey, CancellationToken ct = default);
    Task DeleteManifestAsync(string urn, CancellationToken ct = default);
}
