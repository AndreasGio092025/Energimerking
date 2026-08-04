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
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var cmd = new NpgsqlCommand(
                "SELECT custom_ST_GetPoints(@z, @x, @y);",
                conn
            );

            cmd.Parameters.AddWithValue("z", z);
            cmd.Parameters.AddWithValue("x", x);
            cmd.Parameters.AddWithValue("y", y);

            var result = await cmd.ExecuteScalarAsync();

            if (result == null || result == DBNull.Value)
                return null;

            return (byte[])result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Tile DB error for z={z}, x={x}, y={y}: {ex.GetType().FullName}: {ex.Message}");
            Console.WriteLine(ex.ToString());
            return null;
        }
    }
}