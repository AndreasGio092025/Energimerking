-- Vektor-tiles (MVT) for kartet, hentet fra TilesAndBackend (Backend/WebApi/TileFunction.sql).
-- Bare custom_ST_GetPoints er tatt med: det er den TileService kaller. De andre
-- get_mvt_*-variantene var forsøk/debug og brukes ikke.
-- Kan kjøres på nytt (CREATE ... IF NOT EXISTS / CREATE OR REPLACE).

-- Hvorfor indeks på coordinate::geometry: kolonnen er geography(4258), men tile-søket
-- sammenligner med en geometry-firkant. Uten en GiST-indeks på samme uttrykk må
-- Postgres lese hele tabellen for hver tile.
CREATE INDEX IF NOT EXISTS idx_denorm_oslo_coordinate_geom
ON denorm_matrikkel_og_enova_oslo
USING gist ((coordinate::geometry));

CREATE OR REPLACE FUNCTION public.custom_ST_GetPoints(
    z integer,
    x integer,
    y integer
)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
WITH tile AS (
    SELECT
        -- Tile-firkanten i Web Mercator (3857), som kartet bruker.
        ST_TileEnvelope(z, x, y) AS tile_3857,
        -- Samme firkant med litt margin, gjort om til dataenes system (4258),
        -- så punkter på kanten ikke forsvinner mellom to tiles.
        ST_Transform(
            ST_TileEnvelope(z, x, y, margin => 64.0 / 4096),
            4258
        ) AS query_4258
),

filtered AS (
    SELECT
        id,
        adresse,
        "attestNr",
        matierialvalg AS materialvalg,
        "byggeår" AS byggeaar,
        "gaardsNr" AS gard,
        "bruksenhetsNr",
        "energikarakter",
        "oppvarmingskarakter",
        "beregnetLevertEnergiTotaltkWhm2"::double precision AS energy,
        coordinate::geometry AS geom_4258,
        tile.tile_3857
    FROM denorm_matrikkel_og_enova_oslo
    CROSS JOIN tile
    -- Under zoom 10 blir det for mange punkter per tile; kartet viser da ingenting.
    WHERE z >= 10
      AND coordinate IS NOT NULL
      -- Samme uttrykk som indeksen over, så indeksen faktisk brukes.
      AND coordinate::geometry && tile.query_4258
),

mvtgeom AS (
    SELECT
        id,
        adresse,
        "attestNr",
        materialvalg,
        byggeaar,
        gard,
        "bruksenhetsNr",
        energikarakter,
        oppvarmingskarakter,
        energy,
        ST_AsMVTGeom(
            ST_Transform(geom_4258, 3857),
            tile_3857,
            4096,
            64,
            true
        ) AS geom
    FROM filtered
),

limited AS (
    SELECT *
    FROM mvtgeom
    WHERE geom IS NOT NULL
    ORDER BY id
    -- Tak per tile så nettleseren ikke får for mye data på lav zoom.
    LIMIT CASE
        WHEN z < 13 THEN 5000
        ELSE 8000
    END
)

SELECT COALESCE(
    ST_AsMVT(limited, 'points', 4096, 'geom'),
    '\x'::bytea
)
FROM limited;
$function$;
