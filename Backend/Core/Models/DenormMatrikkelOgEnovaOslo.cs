using System;
using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace Core.Models;

public partial class DenormMatrikkelOgEnovaOslo
{
    public short? KommuneNr { get; set; }

    public short? GaardsNr { get; set; }

    public short? BruksNr { get; set; }

    public int? SeksjonsNr { get; set; }

    public int? AndelsNr { get; set; }

    public string? FesteNr { get; set; }

    public string? BruksenhetsNr { get; set; }

    public string? Adresse { get; set; }

    public decimal? Lat { get; set; }

    public decimal? Lon { get; set; }

    public Geometry? Coordinate { get; set; }

    public string? OrganisasjonsNr { get; set; }

    public string? AttestNr { get; set; }

    public DateTime? UtstedelsesDato { get; set; }

    public string? Energikarakter { get; set; }

    public string? Oppvarmingskarakter { get; set; }

    public string? BeregnetLevertEnergiTotaltkWhm2 { get; set; }

    public string? Matierialvalg { get; set; }

    public short? Byggeår { get; set; }

    public int Id { get; set; }
}
