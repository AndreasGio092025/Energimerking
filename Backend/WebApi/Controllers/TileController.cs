using Microsoft.AspNetCore.Mvc;
using WebApi.Services;

namespace WebApi.Controllers;

[ApiController]
[Route("tiles")]
public class TileController : ControllerBase
{
    private readonly TileService _tileService;

    public TileController(TileService tileService)
    {
        _tileService = tileService;
    }

    /// <summary>Vektor-tile med energimerkede bygg. Tom (204) under zoom 10 eller uten bygg.</summary>
    [HttpGet("{z:int}/{x:int}/{y:int}.pbf")]
    public async Task<IActionResult> GetTile(int z, int x, int y, CancellationToken ct)
    {
        var max = (1 << z) - 1;
        if (z < 0 || z > 22 || x < 0 || y < 0 || x > max || y > max)
            return BadRequest("Ugyldig tile-koordinat.");

        var tile = await _tileService.GetTileAsync(z, x, y, ct);
        if (tile == null)
            return NoContent();

        return File(tile, "application/vnd.mapbox-vector-tile");
    }
}
