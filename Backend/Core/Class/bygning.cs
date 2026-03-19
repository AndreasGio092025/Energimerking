using System;
using System.Collections.Generic;

namespace ef_core_migration_test.Models;

public partial class bygning
{
    public string bygningsnummer { get; set; } = null!;

    public long eiendomId { get; set; }

    public string? bygningskategori { get; set; }

    public short? byggeaar { get; set; }

    public string? materialvalg { get; set; }

    public int? seksjonsnummer { get; set; }

    public virtual eiendom eiendom { get; set; } = null!;

    public virtual ICollection<energimerke> energimerkes { get; set; } = new List<energimerke>();
}
