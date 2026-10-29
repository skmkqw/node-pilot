using Microsoft.Extensions.Logging.Abstractions;
using NodePilot.Application.Accounts.Errors;
using NodePilot.Application.Accounts.Models;
using NodePilot.Application.Accounts.Services;
using NodePilot.Application.Interfaces.Accounts;
using NodePilot.Application.Interfaces.Common;
using NodePilot.Infrastructure.Security;

namespace NodePilot.Api.Tests.Unit;

[TestFixture]
public class InvitationServiceTests
{
    private const string _password = "invited-user-password";

    private InMemoryStore _store = null!;
    private ManualClock _clock = null!;
    private InvitationService _service = null!;
    private AccountService _accountsService = null!;
    private UserAccount _admin = null!;

    [SetUp]
    public async Task SetUp()
    {
        _store = new InMemoryStore();
        _clock = new ManualClock(new DateTimeOffset(2026, 10, 29, 12, 0, 0, TimeSpan.Zero));
        var hasher = new IdentityPasswordHasher();

        _service = new InvitationService(_store, _store, _store, hasher, _clock, NullLogger<InvitationService>.Instance);
        _accountsService = new AccountService(_store, _store, hasher, NullLogger<AccountService>.Instance);
        _admin = (await _accountsService.CreateInitialAdminAsync("admin", "admin-password")).Value;
    }

    [Test]
    public async Task Create_ReturnsTokenOnce_AndStoresOnlyItsHash()
    {
        var created = (await _service.CreateAsync(_admin.Id, UserRole.Member, 24)).Value;

        var stored = _store.Invitations.Single();

        Assert.That(created.Token, Has.Length.GreaterThanOrEqualTo(43), "256-bit token, base64url");
        Assert.That(created.Token, Does.Match("^[A-Za-z0-9_-]+$"), "safe to put in a URL");
        Assert.That(stored.TokenHash, Is.Not.EqualTo(created.Token));
        Assert.That(stored.TokenHash, Is.EqualTo(InvitationService.HashToken(created.Token)));
        Assert.That(created.ExpiresAtUtc, Is.EqualTo(_clock.GetUtcNow().UtcDateTime.AddHours(24)));
    }

    [Test]
    public async Task Create_TokensAreUnique()
    {
        var first = (await _service.CreateAsync(_admin.Id, UserRole.Member, 1)).Value;
        var second = (await _service.CreateAsync(_admin.Id, UserRole.Member, 1)).Value;

        Assert.That(first.Token, Is.Not.EqualTo(second.Token));
    }

    [TestCase(0)]
    [TestCase(169)]
    public async Task Create_LifetimeOutOfRange_IsRejected(int hours)
    {
        var result = await _service.CreateAsync(_admin.Id, UserRole.Member, hours);

        Assert.That(result.FirstError, Is.EqualTo(InvitationErrors.InvalidLifetime));
    }

    [Test]
    public async Task Accept_CreatesAccountWithInvitedRole_AndLinkWorksOnlyOnce()
    {
        var created = (await _service.CreateAsync(_admin.Id, UserRole.Admin, 24)).Value;

        var preview = await _service.PreviewAsync(created.Token);
        var accepted = await _service.AcceptAsync(created.Token, " anna ", _password);
        var again = await _service.AcceptAsync(created.Token, "someone-else", _password);

        Assert.That(preview.Value.InvitedBy, Is.EqualTo("admin"));
        Assert.That(accepted.Value.Username, Is.EqualTo("anna"));
        Assert.That(accepted.Value.Role, Is.EqualTo(UserRole.Admin));
        Assert.That(accepted.Value.PasswordHash, Does.Not.Contain(_password));
        Assert.That(again.FirstError, Is.EqualTo(InvitationErrors.InvalidOrExpired));
        Assert.That((await _service.PreviewAsync(created.Token)).FirstError, Is.EqualTo(InvitationErrors.InvalidOrExpired));
    }

    [Test]
    public async Task Accept_AfterExpiry_IsRejected()
    {
        var created = (await _service.CreateAsync(_admin.Id, UserRole.Member, 1)).Value;

        _clock.Advance(TimeSpan.FromHours(1));

        var result = await _service.AcceptAsync(created.Token, "late-user", _password);

        Assert.That(result.FirstError, Is.EqualTo(InvitationErrors.InvalidOrExpired));
        Assert.That(await _service.ListPendingAsync(), Is.Empty);
    }

    [Test]
    public async Task Accept_TakenUsername_IsRejected_AndLinkStaysUsable()
    {
        var created = (await _service.CreateAsync(_admin.Id, UserRole.Member, 24)).Value;

        var taken = await _service.AcceptAsync(created.Token, "ADMIN", _password);
        var retry = await _service.AcceptAsync(created.Token, "anna", _password);

        Assert.That(taken.FirstError, Is.EqualTo(AccountErrors.UsernameTaken));
        Assert.That(retry.IsError, Is.False);
    }

    [TestCase("not-a-real-token")]
    [TestCase("")]
    [TestCase(null)]
    public async Task UnknownToken_GetsTheSameErrorAsExpiredOne(string? token)
    {
        var result = await _service.PreviewAsync(token);

        Assert.That(result.FirstError, Is.EqualTo(InvitationErrors.InvalidOrExpired));
    }

    [Test]
    public async Task Revoke_RemovesTheLink()
    {
        var created = (await _service.CreateAsync(_admin.Id, UserRole.Member, 24)).Value;

        await _service.RevokeAsync(created.Id);

        Assert.That((await _service.PreviewAsync(created.Token)).FirstError, Is.EqualTo(InvitationErrors.InvalidOrExpired));
    }

    [Test]
    public async Task AdminCannotRemoveOrDemoteThemselves_ButCanManageOthers()
    {
        var created = (await _service.CreateAsync(_admin.Id, UserRole.Member, 24)).Value;
        var member = (await _service.AcceptAsync(created.Token, "anna", _password)).Value;

        var removeSelf = await _accountsService.RemoveUserAsync(_admin.Id, _admin.Id);
        var demoteSelf = await _accountsService.ChangeRoleAsync(_admin.Id, _admin.Id, UserRole.Member);
        var promote = await _accountsService.ChangeRoleAsync(_admin.Id, member.Id, UserRole.Admin);
        var remove = await _accountsService.RemoveUserAsync(_admin.Id, member.Id);

        Assert.That(removeSelf.FirstError, Is.EqualTo(AccountErrors.CannotModifySelf));
        Assert.That(demoteSelf.FirstError, Is.EqualTo(AccountErrors.CannotModifySelf));
        Assert.That(promote.Value.Role, Is.EqualTo(UserRole.Admin));
        Assert.That(remove.IsError, Is.False);
        Assert.That((await _accountsService.ListUsersAsync()).Select(user => user.Username), Is.EqualTo(new[] { "admin" }));
    }

    private sealed class ManualClock(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }

    /// <summary>Mimics the users and invitations tables, including the case-insensitive username.</summary>
    private sealed class InMemoryStore : IUserAccountRepository, IInvitationRepository, IUnitOfWork
    {
        private readonly List<UserAccount> _users = [];

        public List<Invitation> Invitations { get; } = [];

        public Task<bool> AnyAsync(CancellationToken ct = default) => Task.FromResult(_users.Count > 0);

        Task<UserAccount?> IUserAccountRepository.GetByIdAsync(int id, CancellationToken ct) =>
            Task.FromResult(_users.FirstOrDefault(user => user.Id == id));

        public Task<UserAccount?> GetByUsernameAsync(string username, CancellationToken ct = default) =>
            Task.FromResult(_users.FirstOrDefault(user => string.Equals(user.Username, username, StringComparison.OrdinalIgnoreCase)));

        public Task<IReadOnlyList<UserAccount>> ListAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<UserAccount>>(_users.ToList());

        public Task AddAsync(UserAccount account, CancellationToken ct = default)
        {
            SetId(account, _users.Count == 0 ? 1 : _users.Max(user => user.Id) + 1);
            _users.Add(account);
            return Task.CompletedTask;
        }

        public void Remove(UserAccount account)
        {
            _users.Remove(account);
            Invitations.RemoveAll(invitation => invitation.CreatedByUserId == account.Id);
        }

        Task<Invitation?> IInvitationRepository.GetByIdAsync(int id, CancellationToken ct) =>
            Task.FromResult(Invitations.FirstOrDefault(invitation => invitation.Id == id));

        public Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
            Task.FromResult(WithCreator(Invitations.FirstOrDefault(invitation => invitation.TokenHash == tokenHash)));

        public Task<IReadOnlyList<Invitation>> ListPendingAsync(DateTime nowUtc, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<Invitation>>(Invitations
                .Where(invitation => invitation.IsUsable(nowUtc))
                .Select(invitation => WithCreator(invitation)!)
                .ToList());

        public Task AddAsync(Invitation invitation, CancellationToken ct = default)
        {
            SetId(invitation, Invitations.Count + 1);
            Invitations.Add(invitation);
            return Task.CompletedTask;
        }

        public void Remove(Invitation invitation) => Invitations.Remove(invitation);

        public Task RemoveExpiredAsync(DateTime nowUtc, CancellationToken ct = default)
        {
            Invitations.RemoveAll(invitation => invitation.AcceptedAtUtc is null && invitation.ExpiresAtUtc <= nowUtc);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;

        // Like EF Core's Include(): fills the navigation property.
        private Invitation? WithCreator(Invitation? invitation)
        {
            if (invitation is not null)
            {
                typeof(Invitation).GetProperty(nameof(Invitation.CreatedBy))!
                    .SetValue(invitation, _users.FirstOrDefault(user => user.Id == invitation.CreatedByUserId));
            }

            return invitation;
        }

        // Like EF Core: the generated key is written back to the same instance.
        private static void SetId(object entity, int id) =>
            entity.GetType().GetProperty("Id")!.SetValue(entity, id);
    }
}
