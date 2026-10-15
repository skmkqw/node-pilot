using NodePilot.Api.Cors;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class OriginPolicyTests
{
    [TestCase("http://localhost:3000")]
    [TestCase("http://127.0.0.1:3000")]
    [TestCase("http://192.168.1.20:3000")]
    [TestCase("http://10.0.0.5")]
    [TestCase("http://172.16.4.2:3000")]
    [TestCase("http://172.31.255.255:3000")]
    [TestCase("http://raspberrypi.local:3000")]
    [TestCase("http://[::1]:3000")]
    [TestCase("http://[fd12:3456::1]:3000")]
    public void IsPrivateNetworkOrigin_LanOrigins_ReturnsTrue(string origin)
    {
        Assert.That(OriginPolicy.IsPrivateNetworkOrigin(origin), Is.True);
    }

    [TestCase("https://evil.example.com")]
    [TestCase("http://8.8.8.8")]
    [TestCase("http://172.32.0.1:3000")]
    [TestCase("http://192.169.1.1")]
    [TestCase("file:///etc/passwd")]
    [TestCase("not a url")]
    public void IsPrivateNetworkOrigin_PublicOrInvalidOrigins_ReturnsFalse(string origin)
    {
        Assert.That(OriginPolicy.IsPrivateNetworkOrigin(origin), Is.False);
    }

    [Test]
    public void IsAllowed_ConfiguredPublicOrigin_ReturnsTrue()
    {
        var settings = new CorsSettings { AllowedOrigins = ["https://panel.example.com"] };

        Assert.That(OriginPolicy.IsAllowed("https://panel.example.com", settings), Is.True);
    }

    [Test]
    public void IsAllowed_PrivateOriginWhenLanAccessDisabled_ReturnsFalse()
    {
        var settings = new CorsSettings { AllowPrivateNetworkOrigins = false };

        Assert.That(OriginPolicy.IsAllowed("http://192.168.1.20:3000", settings), Is.False);
    }
}
