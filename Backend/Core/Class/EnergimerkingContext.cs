using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace ef_core_migration_test.Models;

public partial class EnergimerkingContext : DbContext
{
    public EnergimerkingContext(DbContextOptions<EnergimerkingContext> options)
        : base(options)
    {
    }

    public virtual DbSet<bygning> bygnings { get; set; }

    public virtual DbSet<coordinate> coordinates { get; set; }

    public virtual DbSet<eiendom> eiendoms { get; set; }

    public virtual DbSet<energikarakter> energikarakters { get; set; }

    public virtual DbSet<energimerke> energimerkes { get; set; }

    public virtual DbSet<kommune> kommunes { get; set; }

    public virtual DbSet<oppvarmingskarakter> oppvarmingskarakters { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresExtension("fuzzystrmatch")
            .HasPostgresExtension("postgis")
            .HasPostgresExtension("tiger", "postgis_tiger_geocoder")
            .HasPostgresExtension("topology", "postgis_topology");

        modelBuilder.Entity<bygning>(entity =>
        {
            entity.HasKey(e => e.bygningsnummer).HasName("bygning_pkey");

            entity.ToTable("bygning");

            entity.HasIndex(e => e.eiendomId, "idx_bygning_eiendom");

            entity.Property(e => e.bygningsnummer).HasMaxLength(50);
            entity.Property(e => e.bygningskategori).HasMaxLength(50);
            entity.Property(e => e.materialvalg).HasMaxLength(100);
            entity.Property(e => e.seksjonsnummer).HasDefaultValue(0);

            entity.HasOne(d => d.eiendom).WithMany(p => p.bygnings)
                .HasForeignKey(d => d.eiendomId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bygning_eiendom_id_fkey");
        });

        modelBuilder.Entity<coordinate>(entity =>
        {
            entity.HasKey(e => e.coordinateid).HasName("matrikkelen_pkey");

            entity.Property(e => e.coordinateid).HasDefaultValueSql("nextval('matrikkelen_id_seq'::regclass)");
            entity.Property(e => e.geography).HasColumnType("geography(Point,4258)");
        });

        modelBuilder.Entity<eiendom>(entity =>
        {
            entity.HasKey(e => e.eiendomId).HasName("eiendom_pkey");

            entity.ToTable("eiendom");

            entity.HasIndex(e => e.kommunenummer, "eiendom_table_btree");

            entity.HasIndex(e => new { e.kommunenummer, e.gaardsnummer, e.bruksnummer }, "idx_eiendom_kommune_gnr_bnr");

            entity.HasIndex(e => new { e.kommunenummer, e.gaardsnummer, e.bruksnummer, e.festenummer }, "uq_eiendom_matrikkel").IsUnique();

            entity.Property(e => e.eiendomId).HasDefaultValueSql("nextval('eiendom_eiendom_id_seq'::regclass)");
            entity.Property(e => e.adresse).HasMaxLength(200);
            entity.Property(e => e.andelsnummer).HasDefaultValue(0);
            entity.Property(e => e.kommunenummer).HasMaxLength(4);
            entity.Property(e => e.postnummer).HasMaxLength(4);
            entity.Property(e => e.poststed).HasMaxLength(100);
            entity.Property(e => e.seksjonsnummer).HasDefaultValue(0);

            entity.HasOne(d => d.kommunenummerNavigation).WithMany(p => p.eiendoms)
                .HasForeignKey(d => d.kommunenummer)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("eiendom_kommunenummer_fkey");
        });

        modelBuilder.Entity<energikarakter>(entity =>
        {
            entity.HasKey(e => e.bokstav).HasName("energikarakter_pkey");

            entity.ToTable("energikarakter");

            entity.Property(e => e.bokstav).HasMaxLength(1);
            entity.Property(e => e.beskrivelse).HasMaxLength(100);
        });

        modelBuilder.Entity<energimerke>(entity =>
        {
            entity.HasKey(e => e.attestnummer).HasName("energimerke_pkey");

            entity.ToTable("energimerke");

            entity.Property(e => e.attestnummer).HasMaxLength(50);
            entity.Property(e => e.beregnet_energi_kwh_m2).HasPrecision(10, 2);
            entity.Property(e => e.beregnet_fossilandel).HasPrecision(5, 2);
            entity.Property(e => e.bygningsnummer).HasMaxLength(50);
            entity.Property(e => e.energikarakter).HasMaxLength(1);
            entity.Property(e => e.gyldig_fra).HasComputedColumnSql("utstedelsesdato", true);
            entity.Property(e => e.kilde)
                .HasMaxLength(50)
                .HasDefaultValueSql("'Enova API'::character varying");
            entity.Property(e => e.oppvarmingskarakter).HasMaxLength(10);
            entity.Property(e => e.typeregistrering).HasMaxLength(50);

            entity.HasOne(d => d.bygningsnummerNavigation).WithMany(p => p.energimerkes)
                .HasForeignKey(d => d.bygningsnummer)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("energimerke_bygningsnummer_fkey");

            entity.HasOne(d => d.energikarakterNavigation).WithMany(p => p.energimerkes)
                .HasForeignKey(d => d.energikarakter)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("energimerke_energikarakter_fkey");

            entity.HasOne(d => d.oppvarmingskarakterNavigation).WithMany(p => p.energimerkes)
                .HasForeignKey(d => d.oppvarmingskarakter)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("energimerke_oppvarmingskarakter_fkey");
        });

        modelBuilder.Entity<kommune>(entity =>
        {
            entity.HasKey(e => e.kommunenummer).HasName("kommune_pkey");

            entity.ToTable("kommune");

            entity.Property(e => e.kommunenummer).HasMaxLength(4);
            entity.Property(e => e.navn).HasMaxLength(100);
        });

        modelBuilder.Entity<oppvarmingskarakter>(entity =>
        {
            entity.HasKey(e => e.kode).HasName("oppvarmingskarakter_pkey");

            entity.ToTable("oppvarmingskarakter");

            entity.Property(e => e.kode).HasMaxLength(10);
            entity.Property(e => e.beskrivelse).HasMaxLength(100);
        });
        modelBuilder.HasSequence("bygning_eiendomid_seq").StartsAt(1000000L);

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
