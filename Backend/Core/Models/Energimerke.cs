using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class Energimerke
{
    public string Attestnummer { get; set; } = null!;

    public string Bygningsnummer { get; set; } = null!;

    public DateOnly Utstedelsesdato { get; set; }

    public string? Typeregistrering { get; set; }

    public string Energikarakter { get; set; } = null!;

    public string Oppvarmingskarakter { get; set; } = null!;

    public decimal? BeregnetEnergiKwhM2 { get; set; }

    public decimal? BeregnetFossilandel { get; set; }

    public bool HarEnergivurdering { get; set; }

    public DateOnly? EnergivurderingDato { get; set; }

    public string? Kilde { get; set; }

    public DateOnly? GyldigFra { get; set; }

    public DateOnly? GyldigTil { get; set; }

    public virtual Bygning BygningsnummerNavigation { get; set; } = null!;

    public virtual Energikarakter EnergikarakterNavigation { get; set; } = null!;

    public virtual Oppvarmingskarakter OppvarmingskarakterNavigation { get; set; } = null!;
}
