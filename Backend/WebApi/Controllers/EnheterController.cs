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
[NorskParameterfeil]
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
    public async Task<IActionResult> Punkter(double? lat, double? lon, int? radius, string ordning = "gammel", CancellationToken ct = default)
    {
        var feil = Valider(lat, lon, radius);
        if (feil != null) return BadRequest(feil);

        ordning = (ordning ?? "").Trim().ToLowerInvariant();
        if (!GyldigeOrdninger.Contains(ordning))
            return BadRequest("ordning må være gammel, ny eller alle.");

        var json = await _service.HentPunkterAsync(lat!.Value, lon!.Value, radius!.Value, ordning, ct);
        return Content(json ?? "{\"type\":\"FeatureCollection\",\"features\":[],\"avkortet\":false,\"antall\":0}", "application/json");
    }

    /// <summary>Statistikk per ordning over alle enheter med kartpunkt i sirkelen.</summary>
    [HttpGet("statistikk")]
    [Produces("application/json")]
    public async Task<IActionResult> Statistikk(double? lat, double? lon, int? radius, CancellationToken ct = default)
    {
        var feil = Valider(lat, lon, radius);
        if (feil != null) return BadRequest(feil);

        var json = await _service.HentStatistikkAsync(lat!.Value, lon!.Value, radius!.Value, ct);
        return json == null ? NotFound() : Content(json, "application/json");
    }

    // Manglende parametre skal gi 400, ikke stille bli 0 (kontrakten).
    private static string? Valider(double? lat, double? lon, int? radius)
    {
        if (lat is not { } la || double.IsNaN(la) || la < -90 || la > 90) return Feiltekst("lat");
        if (lon is not { } lo || double.IsNaN(lo) || lo < -180 || lo > 180) return Feiltekst("lon");
        if (radius is not { } r || r < 1 || r > MaksRadius) return Feiltekst("radius");
        return null;
    }

    internal static string Feiltekst(string parameter) => parameter switch
    {
        "lat" => "lat må være et tall mellom -90 og 90.",
        "lon" => "lon må være et tall mellom -180 og 180.",
        "radius" => $"radius må være et heltall mellom 1 og {MaksRadius} meter.",
        _ => $"Ugyldig verdi for {parameter}."
    };
}

/// <summary>
/// Ugyldige tall (f.eks. lat=abc) stoppes av ASP.NET før metoden kjøres, med en engelsk
/// ProblemDetails. Dette filteret kjører før det og gir samme norske 400-tekst som Valider,
/// så klienten får ett format uansett om verdien mangler, er utenfor området eller ikke er et tall.
/// Brukes bare på EnheterController.
/// </summary>
internal sealed class NorskParameterfeilAttribute : Attribute, Microsoft.AspNetCore.Mvc.Filters.IActionFilter, Microsoft.AspNetCore.Mvc.Filters.IOrderedFilter
{
    // ASP.NETs ModelStateInvalidFilter har Order -2000; lavere tall kjører først.
    public int Order => -3000;

    public void OnActionExecuting(Microsoft.AspNetCore.Mvc.Filters.ActionExecutingContext context)
    {
        if (context.ModelState.IsValid) return;
        var parameter = context.ModelState.First(kv => kv.Value?.Errors.Count > 0).Key;
        context.Result = new BadRequestObjectResult(EnheterController.Feiltekst(parameter));
    }

    public void OnActionExecuted(Microsoft.AspNetCore.Mvc.Filters.ActionExecutedContext context) { }
}
