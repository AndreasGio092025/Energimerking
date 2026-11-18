using Microsoft.AspNetCore.Mvc;
using WebApi.Services;

namespace WebApi.Controllers;

/// <summary>
/// Bygg-siden. Begge rutene sender rå JSON fra SQL; feltene står i docs/api-kontrakt.md
/// under «Bygg-oversikt».
/// </summary>
[ApiController]
[Route("api/bygg-oversikt")]
public class ByggOversiktController : ControllerBase
{
    // Bygningsnummer er sifre; attestnummer er UUID. Enkel sjekk så vi ikke sender søppel til databasen.
    private const int MaksLengde = 64;

    private readonly ByggOversiktService _service;

    public ByggOversiktController(ByggOversiktService service)
    {
        _service = service;
    }

    /// <summary>Finner bygningsnummeret for en attest. 404 hvis attesten er ukjent.</summary>
    [HttpGet("fra-attest/{attestnummer}")]
    [Produces("application/json")]
    public async Task<IActionResult> FraAttest(string attestnummer, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(attestnummer) || attestnummer.Length > MaksLengde)
            return BadRequest("Ugyldig attestnummer.");

        var json = await _service.HentFraAttestAsync(attestnummer.Trim(), ct);
        return json == null ? NotFound() : Content(json, "application/json");
    }

    /// <summary>Oversikt for ett bygg med sammenligning mot lignende bygg. 404 hvis bygget ikke har attester.</summary>
    [HttpGet("{bygningsnummer}")]
    [Produces("application/json")]
    public async Task<IActionResult> Oversikt(string bygningsnummer, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(bygningsnummer) || bygningsnummer.Length > MaksLengde
            || !bygningsnummer.All(char.IsDigit))
            return BadRequest("Ugyldig bygningsnummer.");

        var json = await _service.HentOversiktAsync(bygningsnummer, ct);
        return json == null ? NotFound() : Content(json, "application/json");
    }
}
