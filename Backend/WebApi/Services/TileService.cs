using Npgsql;

namespace WebApi.Services;

/// <summary>
/// Henter vektor-tiles (MVT) for «Enkel bygg» fra databasefunksjonen enkel_bygg_tile
/// (Backend/Docker/db-init/), bygget på mv_enhet_punkt. Visning og ordning er validert i controlleren.
/// </summary>
public class TileService
{
    private readonly string _connectionString;
    private readonly ILogger<TileService> _logger;

    public TileService(IConfiguration config, ILogger<TileService> logger)
    {
        _connectionString = config.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("Mangler ConnectionStrings:Postgres i appsettings.");
        _logger = logger;
    }

    public async Task<byte[]?> GetTileAsync(int z, int x, int y, string visning, string ordning, CancellationToken ct = default)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand("SELECT enkel_bygg_tile(@z, @x, @y, @visning, @ordning);", conn);
        cmd.Parameters.AddWithValue("z", z);
        cmd.Parameters.AddWithValue("x", x);
        cmd.Parameters.AddWithValue("y", y);
        cmd.Parameters.AddWithValue("visning", visning);
        cmd.Parameters.AddWithValue("ordning", ordning);

        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is byte[] tile && tile.Length > 0)
            return tile;

        _logger.LogDebug("Tom tile z={Z} x={X} y={Y} visning={Visning} ordning={Ordning}", z, x, y, visning, ordning);
        return null;
    }
}
