using System;
using System.Collections.Generic;

namespace ef_core_migration_test.Models;

public partial class oppvarmingskarakter
{
    public string kode { get; set; } = null!;

    public string beskrivelse { get; set; } = null!;

    public virtual ICollection<energimerke> energimerkes { get; set; } = new List<energimerke>();
}
