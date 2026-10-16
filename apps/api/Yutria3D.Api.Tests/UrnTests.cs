using Yutria3D.Api.Helpers;

namespace Yutria3D.Api.Tests;

public sealed class UrnTests
{
    [Theory]
    [InlineData("hello")]
    [InlineData("urn:adsk.objects:os.object:my-bucket/model.rvt")]
    [InlineData("~~~")]
    [InlineData("???")]
    [InlineData("model with spaces & unicode — ü")]
    public void Roundtrip_RestoresOriginalObjectId(string objectId)
    {
        var urn = Urn.ToBase64UrlNoPadding(objectId);

        Assert.Equal(objectId, Urn.FromBase64Url(urn));
    }

    [Theory]
    [InlineData("hello", "aGVsbG8")]
    [InlineData("~~~", "fn5-")]
    [InlineData("???", "Pz8_")]
    public void ToBase64UrlNoPadding_MatchesKnownVectors(string objectId, string expected)
    {
        Assert.Equal(expected, Urn.ToBase64UrlNoPadding(objectId));
    }

    [Theory]
    [InlineData("hello")]
    [InlineData("~~~")]
    [InlineData("???")]
    [InlineData("urn:adsk.objects:os.object:my-bucket/model.rvt")]
    public void ToBase64UrlNoPadding_ContainsNoStandardBase64SpecialChars(string objectId)
    {
        var urn = Urn.ToBase64UrlNoPadding(objectId);

        Assert.DoesNotContain("+", urn, StringComparison.Ordinal);
        Assert.DoesNotContain("/", urn, StringComparison.Ordinal);
        Assert.DoesNotContain("=", urn, StringComparison.Ordinal);
    }

    [Fact]
    public void FromBase64Url_DecodesKnownVector()
    {
        Assert.Equal("hello", Urn.FromBase64Url("aGVsbG8"));
    }
}
