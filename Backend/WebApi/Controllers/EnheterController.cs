using Microsoft.AspNetCore.Mvc;
using WebApi.Services;

namespace WebApi.Controllers;

/// <summary>
/// Enheter i kartet (bydelsvisningen): ett punkt per enhet med siste attest, og statistikk
/// regnet i SQL over hele området. Feltene står i docs/api-kontrakt.md under «Enheter i kartet».
/// Uventede feil håndteres av den felles feilhåndteringen i Program.cs (ingen unntakstekst til klienten).
/// </summary>
[ApiController]
[Route("api/enheter")]
public class EnheterController : ControllerBase
{
    private const int MaksRadius = 20_000;
    private static readonly string[] GyldigeOrdninger = ["gammel", "ny", "alle"];

    private readonly EnheterService _service;

    public EnheterController(EnheterService service)
    {
        _service = service;
    }

    /// <summary>Ett kartpunkt per enhet i sirkelen, for valgt ordning (standard gammel).</summary>
    [HttpGet("punkter")]
    [Produces("application/json")]
    public async Task<IActionResult> Punkter(double lat, double lon, int radius, string ordning = "gammel", CancellationToken ct = default)
    {
        var feil = Valider(lat, lon, radius);
        if (feil != null) return BadRequest(feil);

        ordning = (ordning ?? "").Trim().ToLowerInvariant();
        if (!GyldigeOrdninger.Contains(ordning))
            return BadRequest("ordning må være gammel, ny eller alle.");

        var json = await _service.HentPunkterAsync(lat, lon, radius, ordning, ct);
        return Content(json ?? "{\"type\":\"FeatureCollection\",\"features\":[],\"avkortet\":false,\"antall\":0}", "application/json");
    }

    /// <summary>Statistikk per ordning over alle enheter med kartpunkt i sirkelen.</summary>
    [HttpGet("statistikk")]
    [Produces("application/json")]
    public async Task<IActionResult> Statistikk(double lat, double lon, int radius, CancellationToken ct = default)
    {
        var feil = Valider(lat, lon, radius);
        if (feil != null) return BadRequest(feil);

        var json = await _service.HentStatistikkAsync(lat, lon, radius, ct);
        return json == null ? NotFound() : Content(json, "application/json");
    }

    private static string? Valider(double lat, double lon, int radius)
    {
        if (double.IsNaN(lat) || lat < -90 || lat > 90) return "lat må være mellom -90 og 90.";
        if (double.IsNaN(lon) || lon < -180 || lon > 180) return "lon må være mellom -180 og 180.";
        if (radius < 1 || radius > MaksRadius) return $"radius må være mellom 1 og {MaksRadius} meter.";
        return null;
    }
}
