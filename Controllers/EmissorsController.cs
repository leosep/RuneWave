using Microsoft.AspNetCore.Mvc;
using SpotifyClone.Models;
using System.Text.Json;

namespace SpotifyClone.Controllers;

public class EmissorsController : Controller
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IHttpClientFactory _httpClientFactory;

    public EmissorsController(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<IActionResult> Index(string country = "", string category = "", string search = "")
    {
        var emissors = await LoadEmissorsAsync();

        var query = emissors.AsEnumerable();

        if (!string.IsNullOrEmpty(country))
        {
            query = query.Where(e => e.Country.Equals(country, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(e => e.Category != null && e.Category.Equals(category, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            query = query.Where(e =>
                e.Name.ToLower().Contains(s) ||
                (e.Country != null && e.Country.ToLower().Contains(s)) ||
                (e.Category != null && e.Category.ToLower().Contains(s)));
        }

        var countries = emissors.Select(e => e.Country).Distinct().OrderBy(c => c).ToList();
        var categories = emissors.Where(e => e.Category != null).Select(e => e.Category!).Distinct().OrderBy(c => c).ToList();

        ViewBag.Countries = countries;
        ViewBag.Categories = categories;
        ViewBag.SelectedCountry = country;
        ViewBag.SelectedCategory = category;
        ViewBag.Search = search;

        return View(query.ToList());
    }

    [HttpGet]
    public async Task Stream(int id)
    {
        var emissors = await LoadEmissorsAsync();
        var emissor = emissors.FirstOrDefault(e => e.Id == id);
        if (emissor == null || string.IsNullOrEmpty(emissor.StreamUrl))
        {
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync("Station not found");
            return;
        }

        var client = _httpClientFactory.CreateClient();
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, emissor.StreamUrl);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            request.Headers.Add("Accept", "*/*");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            response.EnsureSuccessStatusCode();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "audio/mpeg";
            HttpContext.Response.StatusCode = 200;
            HttpContext.Response.ContentType = contentType;
            HttpContext.Response.Headers["Cache-Control"] = "no-store";

            var buffering = HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpResponseBodyFeature>();
            buffering?.DisableBuffering();

            using var remoteStream = await response.Content.ReadAsStreamAsync();
            await remoteStream.CopyToAsync(HttpContext.Response.Body);
        }
        catch (OperationCanceledException)
        {
            if (!HttpContext.Response.HasStarted)
            {
                HttpContext.Response.StatusCode = 504;
                await HttpContext.Response.WriteAsync("The radio station did not respond in time.");
            }
        }
        catch (Exception)
        {
            if (!HttpContext.Response.HasStarted)
            {
                HttpContext.Response.StatusCode = 502;
                await HttpContext.Response.WriteAsync("Unable to reach the radio station stream.");
            }
        }
    }

    private static async Task<List<Emissor>> LoadEmissorsAsync()
    {
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "data", "emissors.json");
        var json = await System.IO.File.ReadAllTextAsync(filePath);
        return JsonSerializer.Deserialize<List<Emissor>>(json, JsonOptions) ?? new List<Emissor>();
    }
}
