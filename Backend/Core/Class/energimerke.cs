using System;
using System.Collections.Generic;

namespace ef_core_migration_test.Models;

public partial class energimerke
{
    public string attestnummer { get; set; } = null!;

    public string bygningsnummer { get; set; } = null!;

    public DateOnly utstedelsesdato { get; set; }

    public string? typeregistrering { get; set; }

    public string energikarakter { get; set; } = null!;

    public string oppvarmingskarakter { get; set; } = null!;

    public decimal? beregnet_energi_kwh_m2 { get; set; }

    public decimal? beregnet_fossilandel { get; set; }

    public bool har_energivurdering { get; set; }

    public DateOnly? energivurdering_dato { get; set; }

    public string? kilde { get; set; }

    public DateOnly? gyldig_fra { get; set; }

    public DateOnly? gyldig_til { get; set; }

    public virtual bygning bygningsnummerNavigation { get; set; } = null!;

    public virtual energikarakter energikarakterNavigation { get; set; } = null!;

    public virtual oppvarmingskarakter oppvarmingskarakterNavigation { get; set; } = null!;
}
