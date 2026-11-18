using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class MvLeilighetSisteEnergimerke
{
    public string? Adresse { get; set; }

    public string? Bygningsnummer { get; set; }

    public string? Brukenhetsnummer { get; set; }

    public long? Coordinateid { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public string? Attestnummer { get; set; }

    public DateOnly? Utstedelsesdato { get; set; }

    public string? Energikarakter { get; set; }

    public string? Oppvarmingskarakter { get; set; }

    public decimal? BeregnetEnergiKwhM2 { get; set; }

    public long? Rn { get; set; }
}
