using Npgsql;

namespace WebApi.Services;

/// <summary>
/// Henter ferdig JSON for bygg-siden fra SQL-funksjonene i
/// Backend/Docker/db-init/07_bygg_oversikt.sql. Feltene er beskrevet i docs/api-kontrakt.md.
/// </summary>
public class ByggOversiktService
{
    private readonly string _connectionString;

    public ByggOversiktService(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("Mangler ConnectionStrings:Postgres i appsettings.");
    }

    /// <summary>JSON fra bygg_oversikt_json, eller null hvis bygget ikke har attester.</summary>
    public Task<string?> HentOversiktAsync(string bygningsnummer, CancellationToken ct) =>
        HentJsonAsync("SELECT bygg_oversikt_json(@nr)::text;", bygningsnummer, ct);

    /// <summary>JSON fra bygg_fra_attest, eller null hvis attesten er ukjent.</summary>
    public Task<string?> HentFraAttestAsync(string attestnummer, CancellationToken ct) =>
        HentJsonAsync("SELECT bygg_fra_attest(@nr)::text;", attestnummer, ct);

    private async Task<string?> HentJsonAsync(string sql, string verdi, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("nr", verdi);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is string json && json.Length > 0 ? json : null;
    }
}
