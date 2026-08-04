using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("tiles")]
public class TilesController : ControllerBase
{
    private readonly TileService _tileService;

    public TilesController(TileService tileService)
    {
        _tileService = tileService;
    }

    [HttpGet("{z:int}/{x:int}/{y:int}.pbf")]
    public async Task<IActionResult> GetTile(int z, int x, int y)
    {
        Console.WriteLine($"Tile request: z={z}, x={x}, y={y}");

        try
        {
            var tile = await _tileService.GetTileAsync(z, x, y);

            if (tile == null || tile.Length == 0)
            {
                Console.WriteLine($"Empty or missing tile for z={z}, x={x}, y={y}");
                return NoContent();
            }

            Console.WriteLine($"Tile size: {tile.Length}");
            return File(tile, "application/x-protobuf");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Tile request failed for z={z}, x={x}, y={y}: {ex}");
            return Problem(title: "Tile generation failed", detail: ex.Message, statusCode: 500);
        }
    }
}