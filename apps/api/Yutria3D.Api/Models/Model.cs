namespace Yutria3D.Api.Models;

public sealed class Model
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BucketKey { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string Urn { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public int Progress { get; set; }
    public string? FailureMessage { get; set; }
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}
