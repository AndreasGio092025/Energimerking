using Core.Class;
using ef_core_migration_test.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;

namespace WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class coordinateController : ControllerBase
    {
        private readonly EnergimerkingContext _context;

        public coordinateController(EnergimerkingContext context)
        {
            _context = context;
        }

        [HttpGet("nearby")]
        public async Task<ActionResult<IEnumerable<TestDTO>>> GetNearby(
            double latitude,
            double longitude,
            double radiusInMeters)
        {
            
            var factory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4258);
            var point = factory.CreatePoint(new Coordinate(longitude, latitude)); 

                var data = await _context.coordinates
                .Where(c => c.geography != null &&
                            c.geography.IsWithinDistance(point, radiusInMeters))
                .ToListAsync(); 

            var result = data.Select(c => new TestDTO
            {
                Id = c.coordinateid,
                Latitude = c.geography!.Y,
                Longitude = c.geography!.X
            }).ToList();
            return Ok(result);
        }
    }
}
