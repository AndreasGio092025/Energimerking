using System;
using System.Collections.Generic;

namespace ef_core_migration_test.Models;

public partial class eiendom
{
    public long eiendomId { get; set; }

    public string kommunenummer { get; set; } = null!;

    public int gaardsnummer { get; set; }

    public int bruksnummer { get; set; }

    public int festenummer { get; set; }

    public string? adresse { get; set; }

    public string? postnummer { get; set; }

    public string? poststed { get; set; }

    public int? seksjonsnummer { get; set; }

    public int? andelsnummer { get; set; }

    public long? coordinateId { get; set; }

    public virtual ICollection<bygning> bygnings { get; set; } = new List<bygning>();

    public virtual kommune kommunenummerNavigation { get; set; } = null!;

    public virtual coordinate? coordinateNavigation { get; set; }
}
