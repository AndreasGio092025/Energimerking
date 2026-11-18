using Npgsql;

namespace WebApi.Services;

/// <summary>
/// Henter vektor-tiles (MVT) fra databasefunksjonen custom_ST_GetPoints
/// (Backend/Docker/db-init/03_tile_functions.sql).
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

    public async Task<byte[]?> GetTileAsync(int z, int x, int y, CancellationToken ct = default)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand("SELECT custom_ST_GetPoints(@z, @x, @y);", conn);
        cmd.Parameters.AddWithValue("z", z);
        cmd.Parameters.AddWithValue("x", x);
        cmd.Parameters.AddWithValue("y", y);

        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is byte[] tile && tile.Length > 0)
            return tile;

        _logger.LogDebug("Tom tile z={Z} x={X} y={Y}", z, x, y);
        return null;
    }
}
