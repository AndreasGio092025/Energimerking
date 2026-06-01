using Npgsql;

public class TileService
{
    private readonly string _connectionString;

    public TileService(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Postgres");
    }

    public async Task<byte[]?> GetTileAsync(int z, int x, int y)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var cmd = new NpgsqlCommand(
            "SELECT get_mvt_points_debug(@z, @x, @y);",
            conn
        );

        cmd.Parameters.AddWithValue("z", z);
        cmd.Parameters.AddWithValue("x", x);
        cmd.Parameters.AddWithValue("y", y);

        var result = await cmd.ExecuteScalarAsync();

        if(result == null || result == DBNull.Value)
            return null;
        
        return (byte[])result;
    }
}