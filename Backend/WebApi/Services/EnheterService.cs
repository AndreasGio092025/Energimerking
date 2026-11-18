using Npgsql;

namespace WebApi.Services;

/// <summary>
/// Henter ferdig JSON for enheter i kartet fra SQL-funksjonene i
/// Backend/Docker/db-init/08_enheter_kart.sql. Feltene er beskrevet i docs/api-kontrakt.md
/// under «Enheter i kartet».
/// </summary>
public class EnheterService
{
    private readonly string _connectionString;

    public EnheterService(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("Mangler ConnectionStrings:Postgres i appsettings.");
    }

    public Task<string?> HentPunkterAsync(double lat, double lon, int radius, string ordning, CancellationToken ct) =>
        HentJsonAsync(
            "SELECT enheter_punkter_json(@lat, @lon, @radius, @ordning)::text;",
            ct,
            ("lat", lat), ("lon", lon), ("radius", radius), ("ordning", ordning));

    public Task<string?> HentStatistikkAsync(double lat, double lon, int radius, CancellationToken ct) =>
        HentJsonAsync(
            "SELECT enheter_statistikk_json(@lat, @lon, @radius)::text;",
            ct,
            ("lat", lat), ("lon", lon), ("radius", radius));

    private async Task<string?> HentJsonAsync(string sql, CancellationToken ct, params (string Navn, object Verdi)[] parametre)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (navn, verdi) in parametre)
            cmd.Parameters.AddWithValue(navn, verdi);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is string json && json.Length > 0 ? json : null;
    }
}
