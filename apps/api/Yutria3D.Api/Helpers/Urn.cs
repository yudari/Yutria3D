using System.Text;

namespace Yutria3D.Api.Helpers;

public static class Urn
{
    public static string ToBase64UrlNoPadding(string objectId)
    {
        ArgumentNullException.ThrowIfNull(objectId);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(objectId))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string FromBase64Url(string urn)
    {
        ArgumentNullException.ThrowIfNull(urn);
        var s = urn.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Encoding.UTF8.GetString(Convert.FromBase64String(s));
    }
}
