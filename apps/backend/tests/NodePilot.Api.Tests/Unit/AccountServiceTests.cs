using Microsoft.Extensions.Logging.Abstractions;
using NodePilot.Application.Accounts.Errors;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Accounts.Services;
using NodePilot.Application.Interfaces.Accounts;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Infrastructure.Security;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class AccountServiceTests
{
    private const string _password = "correct-horse-battery";

    private InMemoryAccounts _accounts = null!;
    private AccountService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _accounts = new InMemoryAccounts();
        _service = new AccountService(_accounts, _accounts, new IdentityPasswordHasher(), NullLogger<AccountService>.Instance);
    }

    [Test]
    public async Task Setup_CreatesAdministratorWithHashedPassword()
    {
        Assert.That(await _service.IsSetupRequiredAsync(), Is.True);

        var result = await _service.CreateInitialAdminAsync(" artem ", _password);

        Assert.That(result.IsError, Is.False);
        Assert.That(result.Value.Username, Is.EqualTo("artem"));
        Assert.That(result.Value.PasswordHash, Does.Not.Contain(_password));
        Assert.That(await _service.IsSetupRequiredAsync(), Is.False);
    }

    [Test]
    public async Task Setup_SecondTime_ReturnsConflict()
    {
        await _service.CreateInitialAdminAsync("artem", _password);

        var second = await _service.CreateInitialAdminAsync("intruder", "another-password");

        Assert.That(second.FirstError, Is.EqualTo(AccountErrors.SetupAlreadyCompleted));
        Assert.That(_accounts.Count, Is.EqualTo(1));
    }

    [TestCase("ab")]
    [TestCase("has space")]
    [TestCase("ünïcode")]
    [TestCase("")]
    public async Task Setup_InvalidUsername_ReturnsValidationError(string username)
    {
        var result = await _service.CreateInitialAdminAsync(username, _password);

        Assert.That(result.Errors, Does.Contain(AccountErrors.InvalidUsername));
    }

    [TestCase("short")]
    [TestCase("        ")]
    public async Task Setup_WeakPassword_ReturnsValidationError(string password)
    {
        var result = await _service.CreateInitialAdminAsync("artem", password);

        Assert.That(result.Errors, Does.Contain(AccountErrors.WeakPassword));
    }

    [Test]
    public async Task ValidateCredentials_AcceptsCorrectPasswordAndIgnoresUsernameCase()
    {
        await _service.CreateInitialAdminAsync("artem", _password);

        var result = await _service.ValidateCredentialsAsync("ARTEM", _password);

        Assert.That(result.IsError, Is.False);
    }

    [TestCase("artem", "wrong-password")]
    [TestCase("nobody", _password)]
    [TestCase(null, null)]
    public async Task ValidateCredentials_WrongUserOrPassword_ReturnsSameError(string? username, string? password)
    {
        await _service.CreateInitialAdminAsync("artem", _password);

        var result = await _service.ValidateCredentialsAsync(username, password);

        // The same error for an unknown user and a wrong password: no username enumeration.
        Assert.That(result.FirstError, Is.EqualTo(AccountErrors.InvalidCredentials));
    }

    [Test]
    public async Task ChangePassword_RequiresCurrentPasswordAndReplacesHash()
    {
        var account = (await _service.CreateInitialAdminAsync("artem", _password)).Value;

        var wrong = await _service.ChangePasswordAsync(account.Id, "not-the-password", "new-password-123");
        var ok = await _service.ChangePasswordAsync(account.Id, _password, "new-password-123");

        Assert.That(wrong.FirstError, Is.EqualTo(AccountErrors.CurrentPasswordIncorrect));
        Assert.That(ok.IsError, Is.False);
        Assert.That((await _service.ValidateCredentialsAsync("artem", _password)).IsError, Is.True);
        Assert.That((await _service.ValidateCredentialsAsync("artem", "new-password-123")).IsError, Is.False);
    }

    [Test]
    public async Task ChangePassword_WeakNewPassword_IsRejected()
    {
        var account = (await _service.CreateInitialAdminAsync("artem", _password)).Value;

        var result = await _service.ChangePasswordAsync(account.Id, _password, "123");

        Assert.That(result.FirstError, Is.EqualTo(AccountErrors.WeakPassword));
    }

    /// <summary>Mimics the users table, including its case-insensitive username column.</summary>
    private sealed class InMemoryAccounts : IUserAccountRepository, IUnitOfWork
    {
        private readonly List<UserAccount> _items = [];

        public int Count => _items.Count;

        public Task<bool> AnyAsync(CancellationToken ct = default) => Task.FromResult(_items.Count > 0);

        public Task<UserAccount?> GetByIdAsync(int id, CancellationToken ct = default) =>
            Task.FromResult(_items.FirstOrDefault(item => item.Id == id));

        public Task<UserAccount?> GetByUsernameAsync(string username, CancellationToken ct = default) =>
            Task.FromResult(_items.FirstOrDefault(item => string.Equals(item.Username, username, StringComparison.OrdinalIgnoreCase)));

        public Task<IReadOnlyList<UserAccount>> ListAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<UserAccount>>(_items.ToList());

        public void Remove(UserAccount account) => _items.Remove(account);

        public Task AddAsync(UserAccount account, CancellationToken ct = default)
        {
            // Like EF Core: the generated key is written back to the same instance.
            typeof(UserAccount).GetProperty(nameof(UserAccount.Id))!.SetValue(account, _items.Count + 1);
            _items.Add(account);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;
    }
}
