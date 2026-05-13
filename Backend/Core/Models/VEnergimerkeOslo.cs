using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class VEnergimerkeOslo
{
    public string? Attestnummer { get; set; }

    public DateOnly? Utstedelsesdato { get; set; }

    public string? Energikarakter { get; set; }

    public string? Oppvarmingskarakter { get; set; }

    public decimal? BeregnetEnergiKwhM2 { get; set; }

    public decimal? BeregnetFossilandel { get; set; }

    public string? Bygningsnummer { get; set; }

    public string? Bygningskategori { get; set; }

    public short? Byggeaar { get; set; }

    public long? EiendomId { get; set; }

    public string? Adresse { get; set; }

    public string? Postnummer { get; set; }

    public string? Poststed { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public long? Coordinateid { get; set; }
}
