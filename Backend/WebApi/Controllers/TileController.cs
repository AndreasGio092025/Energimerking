using Microsoft.AspNetCore.Mvc;
using WebApi.Services;

namespace WebApi.Controllers;

/// <summary>
/// Vektor-tiles for «Enkel bygg»: ett punkt per enhet eller per bygg, i én ordning om gangen.
/// Feltene står i docs/api-kontrakt.md under «Vektor-tiles for «Enkel bygg»».
/// </summary>
[ApiController]
[Route("tiles")]
public class TileController : ControllerBase
{
    private static readonly string[] GyldigeVisninger = ["enheter", "bygg"];
    private static readonly string[] GyldigeOrdninger = ["gammel", "ny"];

    private readonly TileService _tileService;

    public TileController(TileService tileService)
    {
        _tileService = tileService;
    }

    /// <summary>Vektor-tile (lag «enheter» eller «bygg»). Tom (204) under zoom 10 eller uten punkter.</summary>
    [HttpGet("{z:int}/{x:int}/{y:int}.pbf")]
    public async Task<IActionResult> GetTile(int z, int x, int y, string visning = "enheter", string ordning = "gammel", CancellationToken ct = default)
    {
        if (z < 0 || z > 22) return BadRequest("Ugyldig tile-koordinat.");
        var max = (1 << z) - 1;
        if (x < 0 || y < 0 || x > max || y > max)
            return BadRequest("Ugyldig tile-koordinat.");

        visning = (visning ?? "").Trim().ToLowerInvariant();
        if (!GyldigeVisninger.Contains(visning))
            return BadRequest("visning må være enheter eller bygg.");

        // Ingen «alle»: gammel og ny ordning blandes aldri i samme kart (CLAUDE.md).
        ordning = (ordning ?? "").Trim().ToLowerInvariant();
        if (!GyldigeOrdninger.Contains(ordning))
            return BadRequest("ordning må være gammel eller ny.");

        var tile = await _tileService.GetTileAsync(z, x, y, visning, ordning, ct);
        if (tile == null)
            return NoContent();

        return File(tile, "application/vnd.mapbox-vector-tile");
    }
}
