using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class Bygning
{
    public string Bygningsnummer { get; set; } = null!;

    public long EiendomId { get; set; }

    public string? Bygningskategori { get; set; }

    public short? Byggeaar { get; set; }

    public string? Materialvalg { get; set; }

    public int? Seksjonsnummer { get; set; }

    public virtual Eiendom Eiendom { get; set; } = null!;

    public virtual ICollection<Energimerke> Energimerkes { get; set; } = new List<Energimerke>();
}
