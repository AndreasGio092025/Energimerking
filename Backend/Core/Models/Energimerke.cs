using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class Energimerke
{
    public string Attestnummer { get; set; } = null!;

    public string? Bygningsnummer { get; set; }

    public DateOnly Utstedelsesdato { get; set; }

    public string? Typeregistrering { get; set; }

    public string Energikarakter { get; set; } = null!;

    public string Oppvarmingskarakter { get; set; } = null!;

    public decimal? BeregnetEnergiKwhM2 { get; set; }

    public bool HarEnergivurdering { get; set; }

    public DateOnly? EnergivurderingDato { get; set; }

    public string? Kilde { get; set; }

    public decimal? BeregnetFossilandel { get; set; }

    public long? BygningeiendomId { get; set; }

    public virtual EiendomBygning? Bygningeiendom { get; set; }

    public virtual Energikarakter EnergikarakterNavigation { get; set; } = null!;
}
