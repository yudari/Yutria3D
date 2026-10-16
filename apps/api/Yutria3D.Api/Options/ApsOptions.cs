namespace Yutria3D.Api.Options;

public sealed class ApsOptions
{
    public const string SectionName = "Aps";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;
    public int MaxUploadMb { get; set; } = 100;
}
