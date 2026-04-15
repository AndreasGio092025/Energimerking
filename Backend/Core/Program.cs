// See https://aka.ms/new-console-template for more information

using Core.Class.DTOs;
using Core.Models;

Console.WriteLine("Hello, World!");
var gjsonList = new List<CoordinateGeojsonDto>();
var serila = new GeojsonSerializer<CoordinateGeojsonDto>(gjsonList);