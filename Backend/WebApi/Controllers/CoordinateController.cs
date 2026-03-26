using Core.Class;
using Core.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using Coordinate = NetTopologySuite.Geometries.Coordinate;

namespace WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CoordinateController : ControllerBase
    {
        private readonly EnergimerkingContext _context;
        private readonly ILogger<EnergimerkingContext> _logger;

        public CoordinateController(EnergimerkingContext context,ILogger<EnergimerkingContext> logger)
        {
            _logger = logger;
            _context = context;
        }

        /*[HttpGet("nearby")]
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
        }*/
        [HttpGet("/alljson")]
        /* Se navngivningen på denne metoden. */
        public async Task<IActionResult> GetAllJson(){
            try
            {
                
                /*List<FeatureCollection> list = await context.GetAllCoordinateGeojson();
                var json = JsonSerializer.Serialize(list, options);*/
                return Ok(await _context.GetAllCoordinateGeojson());
            
            }
            catch(Exception ex)
            {
                _logger.LogError(ex.Message);
                return StatusCode(500, ex.Message);
            }
        }
    }
}
