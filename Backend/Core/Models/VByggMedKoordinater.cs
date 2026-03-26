using System;
using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace Core.Models;

public partial class VByggMedKoordinater
{
    public string? Bygningsnummer { get; set; }

    public string? Bygningskategori { get; set; }

    public short? Byggeaar { get; set; }

    public string? Materialvalg { get; set; }

    public int? BygningSeksjonsnummer { get; set; }

    public long? EiendomId { get; set; }

    public string? Adresse { get; set; }

    public string? Postnummer { get; set; }

    public string? Poststed { get; set; }

    public string? Kommunenummer { get; set; }

    public int? Gaardsnummer { get; set; }

    public int? Bruksnummer { get; set; }

    public int? Festenummer { get; set; }

    public int? EiendomSeksjonsnummer { get; set; }

    public int? Andelsnummer { get; set; }

    public string? MatrikkelNøkkel { get; set; }

    public long? Coordinateid { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public Point? Geography { get; set; }

    public string? Attestnummer { get; set; }

    public DateOnly? Utstedelsesdato { get; set; }

    public string? Energikarakter { get; set; }

    public string? EnergikarakterBeskrivelse { get; set; }

    public string? Oppvarmingskarakter { get; set; }

    public string? OppvarmingskarakterBeskrivelse { get; set; }

    public decimal? EnergibrukKwhM2 { get; set; }

    public decimal? BeregnetFossilandel { get; set; }

    public bool? HarEnergivurdering { get; set; }

    public DateOnly? EnergivurderingDato { get; set; }

    public DateOnly? GyldigFra { get; set; }

    public DateOnly? GyldigTil { get; set; }

    public string? Kilde { get; set; }

    public string? Typeregistrering { get; set; }

    public string? Kommunenavn { get; set; }
}
