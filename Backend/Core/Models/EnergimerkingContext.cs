using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Core.Models;

public partial class EnergimerkingContext : DbContext
{
    public EnergimerkingContext()
    {
    }

    public EnergimerkingContext(DbContextOptions<EnergimerkingContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Bygning> Bygnings { get; set; }

    public virtual DbSet<Coordinate> Coordinates { get; set; }

    public virtual DbSet<CoordinatesRaw> CoordinatesRaws { get; set; }

    public virtual DbSet<Eiendom> Eiendoms { get; set; }

    public virtual DbSet<Energikarakter> Energikarakters { get; set; }

    public virtual DbSet<Energimerke> Energimerkes { get; set; }

    public virtual DbSet<Kommune> Kommunes { get; set; }

    public virtual DbSet<Oppvarmingskarakter> Oppvarmingskarakters { get; set; }

    public virtual DbSet<VByggMedKoordinater> VByggMedKoordinaters { get; set; }

 
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresExtension("fuzzystrmatch")
            .HasPostgresExtension("postgis")
            .HasPostgresExtension("tiger", "postgis_tiger_geocoder")
            .HasPostgresExtension("topology", "postgis_topology");

        modelBuilder.Entity<Bygning>(entity =>
        {
            entity.HasKey(e => e.Bygningsnummer).HasName("bygning_pkey");

            entity.ToTable("bygning");

            entity.HasIndex(e => e.EiendomId, "idx_bygning_eiendom");

            entity.Property(e => e.Bygningsnummer)
                .HasMaxLength(50)
                .HasColumnName("bygningsnummer");
            entity.Property(e => e.Byggeaar).HasColumnName("byggeaar");
            entity.Property(e => e.Bygningskategori)
                .HasMaxLength(50)
                .HasColumnName("bygningskategori");
            entity.Property(e => e.EiendomId).HasColumnName("eiendomId");
            entity.Property(e => e.Materialvalg)
                .HasMaxLength(100)
                .HasColumnName("materialvalg");
            entity.Property(e => e.Seksjonsnummer)
                .HasDefaultValue(0)
                .HasColumnName("seksjonsnummer");

            entity.HasOne(d => d.Eiendom).WithMany(p => p.Bygnings)
                .HasForeignKey(d => d.EiendomId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bygning_eiendom_id_fkey");
        });

        modelBuilder.Entity<Coordinate>(entity =>
        {
            entity.HasKey(e => e.Coordinateid).HasName("matrikkelen_pkey");

            entity.ToTable("coordinates");

            entity.Property(e => e.Coordinateid)
                .HasDefaultValueSql("nextval('matrikkelen_id_seq'::regclass)")
                .HasColumnName("coordinateid");
            entity.Property(e => e.Bruksnummer).HasColumnName("bruksnummer");
            entity.Property(e => e.Gaardsnummer).HasColumnName("gaardsnummer");
            entity.Property(e => e.Geography)
                .HasColumnType("geography(Point,4258)")
                .HasColumnName("geography");
            entity.Property(e => e.Kommunenummer).HasColumnName("kommunenummer");
            entity.Property(e => e.Latitude).HasColumnName("latitude");
            entity.Property(e => e.Longitude).HasColumnName("longitude");
            entity.Property(e => e.MatrikkelNøkkel)
                .HasMaxLength(50)
                .HasColumnName("matrikkel_nøkkel");
        });

        modelBuilder.Entity<CoordinatesRaw>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("coordinates_raw");

            entity.Property(e => e.Col1).HasColumnName("col1");
            entity.Property(e => e.Col10).HasColumnName("col10");
            entity.Property(e => e.Col11).HasColumnName("col11");
            entity.Property(e => e.Col12).HasColumnName("col12");
            entity.Property(e => e.Col13).HasColumnName("col13");
            entity.Property(e => e.Col14).HasColumnName("col14");
            entity.Property(e => e.Col15).HasColumnName("col15");
            entity.Property(e => e.Col16).HasColumnName("col16");
            entity.Property(e => e.Col17).HasColumnName("col17");
            entity.Property(e => e.Col18).HasColumnName("col18");
            entity.Property(e => e.Col19).HasColumnName("col19");
            entity.Property(e => e.Col2).HasColumnName("col2");
            entity.Property(e => e.Col20).HasColumnName("col20");
            entity.Property(e => e.Col21).HasColumnName("col21");
            entity.Property(e => e.Col22).HasColumnName("col22");
            entity.Property(e => e.Col23).HasColumnName("col23");
            entity.Property(e => e.Col24).HasColumnName("col24");
            entity.Property(e => e.Col25).HasColumnName("col25");
            entity.Property(e => e.Col26).HasColumnName("col26");
            entity.Property(e => e.Col27).HasColumnName("col27");
            entity.Property(e => e.Col28).HasColumnName("col28");
            entity.Property(e => e.Col29).HasColumnName("col29");
            entity.Property(e => e.Col3).HasColumnName("col3");
            entity.Property(e => e.Col30).HasColumnName("col30");
            entity.Property(e => e.Col31).HasColumnName("col31");
            entity.Property(e => e.Col32).HasColumnName("col32");
            entity.Property(e => e.Col33).HasColumnName("col33");
            entity.Property(e => e.Col34).HasColumnName("col34");
            entity.Property(e => e.Col35).HasColumnName("col35");
            entity.Property(e => e.Col36).HasColumnName("col36");
            entity.Property(e => e.Col37).HasColumnName("col37");
            entity.Property(e => e.Col38).HasColumnName("col38");
            entity.Property(e => e.Col39).HasColumnName("col39");
            entity.Property(e => e.Col4).HasColumnName("col4");
            entity.Property(e => e.Col40).HasColumnName("col40");
            entity.Property(e => e.Col41).HasColumnName("col41");
            entity.Property(e => e.Col42).HasColumnName("col42");
            entity.Property(e => e.Col43).HasColumnName("col43");
            entity.Property(e => e.Col44).HasColumnName("col44");
            entity.Property(e => e.Col45).HasColumnName("col45");
            entity.Property(e => e.Col46).HasColumnName("col46");
            entity.Property(e => e.Col47).HasColumnName("col47");
            entity.Property(e => e.Col5).HasColumnName("col5");
            entity.Property(e => e.Col6).HasColumnName("col6");
            entity.Property(e => e.Col7).HasColumnName("col7");
            entity.Property(e => e.Col8).HasColumnName("col8");
            entity.Property(e => e.Col9).HasColumnName("col9");
        });

        modelBuilder.Entity<Eiendom>(entity =>
        {
            entity.HasKey(e => e.EiendomId).HasName("eiendom_pkey");

            entity.ToTable("eiendom");

            entity.HasIndex(e => e.Kommunenummer, "eiendom_table_btree");

            entity.HasIndex(e => new { e.Kommunenummer, e.Gaardsnummer, e.Bruksnummer }, "idx_eiendom_kommune_gnr_bnr");

            entity.HasIndex(e => new { e.Kommunenummer, e.Gaardsnummer, e.Bruksnummer, e.Festenummer }, "uq_eiendom_matrikkel").IsUnique();

            entity.Property(e => e.EiendomId)
                .HasDefaultValueSql("nextval('eiendom_eiendom_id_seq'::regclass)")
                .HasColumnName("eiendomId");
            entity.Property(e => e.Adresse)
                .HasMaxLength(200)
                .HasColumnName("adresse");
            entity.Property(e => e.Andelsnummer)
                .HasDefaultValue(0)
                .HasColumnName("andelsnummer");
            entity.Property(e => e.Bruksnummer).HasColumnName("bruksnummer");
            entity.Property(e => e.Coordinateid).HasColumnName("coordinateid");
            entity.Property(e => e.Festenummer).HasColumnName("festenummer");
            entity.Property(e => e.Gaardsnummer).HasColumnName("gaardsnummer");
            entity.Property(e => e.Kommunenummer)
                .HasMaxLength(4)
                .HasColumnName("kommunenummer");
            entity.Property(e => e.MatrikkelNøkkel)
                .HasMaxLength(50)
                .HasColumnName("matrikkel_nøkkel");
            entity.Property(e => e.Postnummer)
                .HasMaxLength(4)
                .HasColumnName("postnummer");
            entity.Property(e => e.Poststed)
                .HasMaxLength(100)
                .HasColumnName("poststed");
            entity.Property(e => e.Seksjonsnummer)
                .HasDefaultValue(0)
                .HasColumnName("seksjonsnummer");

            entity.HasOne(d => d.KommunenummerNavigation).WithMany(p => p.Eiendoms)
                .HasForeignKey(d => d.Kommunenummer)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("eiendom_kommunenummer_fkey");
        });

        modelBuilder.Entity<Energikarakter>(entity =>
        {
            entity.HasKey(e => e.Bokstav).HasName("energikarakter_pkey");

            entity.ToTable("energikarakter");

            entity.Property(e => e.Bokstav)
                .HasMaxLength(1)
                .HasColumnName("bokstav");
            entity.Property(e => e.Beskrivelse)
                .HasMaxLength(100)
                .HasColumnName("beskrivelse");
        });

        modelBuilder.Entity<Energimerke>(entity =>
        {
            entity.HasKey(e => e.Attestnummer).HasName("energimerke_pkey");

            entity.ToTable("energimerke");

            entity.Property(e => e.Attestnummer)
                .HasMaxLength(50)
                .HasColumnName("attestnummer");
            entity.Property(e => e.BeregnetEnergiKwhM2)
                .HasPrecision(10, 2)
                .HasColumnName("beregnet_energi_kwh_m2");
            entity.Property(e => e.BeregnetFossilandel)
                .HasPrecision(5, 2)
                .HasColumnName("beregnet_fossilandel");
            entity.Property(e => e.Bygningsnummer)
                .HasMaxLength(50)
                .HasColumnName("bygningsnummer");
            entity.Property(e => e.Energikarakter)
                .HasMaxLength(1)
                .HasColumnName("energikarakter");
            entity.Property(e => e.EnergivurderingDato).HasColumnName("energivurdering_dato");
            entity.Property(e => e.GyldigFra)
                .HasComputedColumnSql("utstedelsesdato", true)
                .HasColumnName("gyldig_fra");
            entity.Property(e => e.GyldigTil).HasColumnName("gyldig_til");
            entity.Property(e => e.HarEnergivurdering).HasColumnName("har_energivurdering");
            entity.Property(e => e.Kilde)
                .HasMaxLength(50)
                .HasDefaultValueSql("'Enova API'::character varying")
                .HasColumnName("kilde");
            entity.Property(e => e.Oppvarmingskarakter)
                .HasMaxLength(10)
                .HasColumnName("oppvarmingskarakter");
            entity.Property(e => e.Typeregistrering)
                .HasMaxLength(50)
                .HasColumnName("typeregistrering");
            entity.Property(e => e.Utstedelsesdato).HasColumnName("utstedelsesdato");

            entity.HasOne(d => d.BygningsnummerNavigation).WithMany(p => p.Energimerkes)
                .HasForeignKey(d => d.Bygningsnummer)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("energimerke_bygningsnummer_fkey");

            entity.HasOne(d => d.EnergikarakterNavigation).WithMany(p => p.Energimerkes)
                .HasForeignKey(d => d.Energikarakter)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("energimerke_energikarakter_fkey");

            entity.HasOne(d => d.OppvarmingskarakterNavigation).WithMany(p => p.Energimerkes)
                .HasForeignKey(d => d.Oppvarmingskarakter)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("energimerke_oppvarmingskarakter_fkey");
        });

        modelBuilder.Entity<Kommune>(entity =>
        {
            entity.HasKey(e => e.Kommunenummer).HasName("kommune_pkey");

            entity.ToTable("kommune");

            entity.Property(e => e.Kommunenummer)
                .HasMaxLength(4)
                .HasColumnName("kommunenummer");
            entity.Property(e => e.Navn)
                .HasMaxLength(100)
                .HasColumnName("navn");
        });

        modelBuilder.Entity<Oppvarmingskarakter>(entity =>
        {
            entity.HasKey(e => e.Kode).HasName("oppvarmingskarakter_pkey");

            entity.ToTable("oppvarmingskarakter");

            entity.Property(e => e.Kode)
                .HasMaxLength(10)
                .HasColumnName("kode");
            entity.Property(e => e.Beskrivelse)
                .HasMaxLength(100)
                .HasColumnName("beskrivelse");
        });

        modelBuilder.Entity<VByggMedKoordinater>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("v_bygg_med_koordinater");

            entity.Property(e => e.Adresse)
                .HasMaxLength(200)
                .HasColumnName("adresse");
            entity.Property(e => e.Andelsnummer).HasColumnName("andelsnummer");
            entity.Property(e => e.Attestnummer)
                .HasMaxLength(50)
                .HasColumnName("attestnummer");
            entity.Property(e => e.BeregnetFossilandel)
                .HasPrecision(5, 2)
                .HasColumnName("beregnet_fossilandel");
            entity.Property(e => e.Bruksnummer).HasColumnName("bruksnummer");
            entity.Property(e => e.Byggeaar).HasColumnName("byggeaar");
            entity.Property(e => e.BygningSeksjonsnummer).HasColumnName("bygning_seksjonsnummer");
            entity.Property(e => e.Bygningskategori)
                .HasMaxLength(50)
                .HasColumnName("bygningskategori");
            entity.Property(e => e.Bygningsnummer)
                .HasMaxLength(50)
                .HasColumnName("bygningsnummer");
            entity.Property(e => e.Coordinateid).HasColumnName("coordinateid");
            entity.Property(e => e.EiendomId).HasColumnName("eiendomId");
            entity.Property(e => e.EiendomSeksjonsnummer).HasColumnName("eiendom_seksjonsnummer");
            entity.Property(e => e.EnergibrukKwhM2)
                .HasPrecision(10, 2)
                .HasColumnName("energibruk_kwh_m2");
            entity.Property(e => e.Energikarakter)
                .HasMaxLength(1)
                .HasColumnName("energikarakter");
            entity.Property(e => e.EnergikarakterBeskrivelse)
                .HasMaxLength(100)
                .HasColumnName("energikarakter_beskrivelse");
            entity.Property(e => e.EnergivurderingDato).HasColumnName("energivurdering_dato");
            entity.Property(e => e.Festenummer).HasColumnName("festenummer");
            entity.Property(e => e.Gaardsnummer).HasColumnName("gaardsnummer");
            entity.Property(e => e.Geography)
                .HasColumnType("geography(Point,4258)")
                .HasColumnName("geography");
            entity.Property(e => e.GyldigFra).HasColumnName("gyldig_fra");
            entity.Property(e => e.GyldigTil).HasColumnName("gyldig_til");
            entity.Property(e => e.HarEnergivurdering).HasColumnName("har_energivurdering");
            entity.Property(e => e.Kilde)
                .HasMaxLength(50)
                .HasColumnName("kilde");
            entity.Property(e => e.Kommunenavn)
                .HasMaxLength(100)
                .HasColumnName("kommunenavn");
            entity.Property(e => e.Kommunenummer)
                .HasMaxLength(4)
                .HasColumnName("kommunenummer");
            entity.Property(e => e.Latitude).HasColumnName("latitude");
            entity.Property(e => e.Longitude).HasColumnName("longitude");
            entity.Property(e => e.Materialvalg)
                .HasMaxLength(100)
                .HasColumnName("materialvalg");
            entity.Property(e => e.MatrikkelNøkkel)
                .HasMaxLength(50)
                .HasColumnName("matrikkel_nøkkel");
            entity.Property(e => e.Oppvarmingskarakter)
                .HasMaxLength(10)
                .HasColumnName("oppvarmingskarakter");
            entity.Property(e => e.OppvarmingskarakterBeskrivelse)
                .HasMaxLength(100)
                .HasColumnName("oppvarmingskarakter_beskrivelse");
            entity.Property(e => e.Postnummer)
                .HasMaxLength(4)
                .HasColumnName("postnummer");
            entity.Property(e => e.Poststed)
                .HasMaxLength(100)
                .HasColumnName("poststed");
            entity.Property(e => e.Typeregistrering)
                .HasMaxLength(50)
                .HasColumnName("typeregistrering");
            entity.Property(e => e.Utstedelsesdato).HasColumnName("utstedelsesdato");
        });
        modelBuilder.HasSequence("bygning_eiendomid_seq").StartsAt(1000000L);

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
