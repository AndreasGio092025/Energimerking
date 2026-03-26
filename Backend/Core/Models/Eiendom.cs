using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class Eiendom
{
    public long EiendomId { get; set; }

    public string Kommunenummer { get; set; } = null!;

    public int Gaardsnummer { get; set; }

    public int Bruksnummer { get; set; }

    public int Festenummer { get; set; }

    public string? Adresse { get; set; }

    public string? Postnummer { get; set; }

    public string? Poststed { get; set; }

    public int? Seksjonsnummer { get; set; }

    public int? Andelsnummer { get; set; }

    public string? MatrikkelNøkkel { get; set; }

    public long? Coordinateid { get; set; }

    public virtual ICollection<Bygning> Bygnings { get; set; } = new List<Bygning>();

    public virtual Kommune KommunenummerNavigation { get; set; } = null!;
}
