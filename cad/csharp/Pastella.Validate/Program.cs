// Pastella.Validate — independent C# validator for the Rust CAD build (cad/rust).
// It never regenerates geometry: it re-reads cad/out (concept) and cad/out/build (real build: URDF + STL, USDA,
// STEP, GLB, report.json, print pieces, BOM, DXF) and cross-checks them against each other and against cad/spec.json.
// Usage: dotnet run --project cad/csharp/Pastella.Validate -- [--root <repo>]   (exit code 1 on failure)

using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

var root = Arg("--root") ?? FindRoot();
var v = new Validator();
var spec = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "cad", "spec.json"))).RootElement;
int keysTotal = spec.GetProperty("keyboard").GetProperty("rows").EnumerateArray().Sum(r => r.GetArrayLength());
foreach (var (tag, rel) in new[] { ("concept", "cad/out"), ("build", "cad/out/build") })
{
    var outDir = Path.Combine(root, rel);
    v.Prefix = tag + " · ";
    var report = JsonDocument.Parse(File.ReadAllText(Path.Combine(outDir, "report.json"))).RootElement;
    var urdf = Urdf.Load(Path.Combine(outDir, "urdf", "pastella84.urdf"));
    var usd = Usda.Load(Path.Combine(outDir, "pastella84.usda"));

    v.Section("report.json");
    v.Check("Rust self-checks passed (watertight, interference, joint sweeps)", report.GetProperty("checks").GetProperty("ok").GetBoolean());

    v.Section("URDF tree");
    v.Check("link names unique", urdf.Links.Select(l => l.Name).Distinct().Count() == urdf.Links.Count);
    v.Check("joint names unique", urdf.Joints.Select(j => j.Name).Distinct().Count() == urdf.Joints.Count);
    v.Check("joints reference existing links", urdf.Joints.All(j => urdf.Has(j.Parent) && urdf.Has(j.Child)));
    var roots = urdf.Links.Where(l => urdf.Joints.All(j => j.Child != l.Name)).Select(l => l.Name).ToList();
    v.Check($"single root 'desk' (found: {string.Join(", ", roots)})", roots.Count == 1 && roots[0] == "desk");
    v.Check("every non-root link has exactly one parent", urdf.Links.Where(l => l.Name != "desk").All(l => urdf.Joints.Count(j => j.Child == l.Name) == 1));
    v.Check("tree reaches every link (acyclic)", urdf.Reachable("desk").Count == urdf.Links.Count);

    v.Section("URDF physics");
    foreach (var l in urdf.Links.Where(l => l.Mass is not null))
    {
        var ev = Linalg.EigSym(l.Inertia!);
        v.Check($"{l.Name}: mass > 0", l.Mass > 0, quiet: true);
        v.Check($"{l.Name}: inertia positive definite", ev.All(e => e > 0), quiet: true);
        v.Check($"{l.Name}: inertia triangle inequality", ev[0] + ev[1] >= ev[2] * (1 - 1e-6) && ev[1] + ev[2] >= ev[0] * (1 - 1e-6) && ev[0] + ev[2] >= ev[1] * (1 - 1e-6), quiet: true);
    }
    v.Check($"{urdf.Links.Count(l => l.Mass is not null)} massive links: mass > 0, inertia PD + triangle inequality", true);
    foreach (var j in urdf.Joints.Where(j => j.Type != "fixed"))
    {
        v.Check($"{j.Name}: unit axis", Math.Abs(Linalg.Norm(j.Axis) - 1) < 1e-4, quiet: true);
        if (j.Type is "revolute" or "prismatic") v.Check($"{j.Name}: lower < upper", j.Lower < j.Upper, quiet: true);
    }
    v.Check($"{urdf.Joints.Count(j => j.Type != "fixed")} movable joints: unit axes, ordered limits", true);

    v.Section("URDF meshes (binary STL)");
    int stlFiles = 0, stlTris = 0;
    foreach (var file in urdf.Links.SelectMany(l => l.Meshes))
    {
        var path = Path.Combine(outDir, "urdf", file);
        if (!File.Exists(path)) { v.Check($"{file} exists", false); continue; }
        var (tris, closed, finite) = Stl.Inspect(path);
        stlFiles++; stlTris += tris;
        v.Check($"{file}: size matches triangle count, finite", finite, quiet: true);
        v.Check($"{file}: watertight (every edge used twice)", closed, quiet: true);
    }
    v.Check($"{stlFiles} STL files, {stlTris} triangles: exist, finite, watertight", stlFiles == urdf.Links.Sum(l => l.Meshes.Count));

    v.Section("URDF vs spec.json");
    var kb = spec.GetProperty("keyboard");
    int keys = kb.GetProperty("rows").EnumerateArray().Sum(r => r.GetArrayLength());
    var keyJoints = urdf.Joints.Where(j => j.Name.StartsWith("key_")).ToList();
    v.Check($"one prismatic joint per key ({keyJoints.Count} / {keys})", keyJoints.Count == keys && keyJoints.All(j => j.Type == "prismatic"));
    double travel = kb.GetProperty("travel").GetDouble() / 1000;
    v.Check($"key travel = {travel * 1000} mm", keyJoints.All(j => Math.Abs(j.Upper - travel) < 1e-9 && j.Lower == 0));
    var mon = spec.GetProperty("monitor");
    var tilt = urdf.Joint("monitor_tilt_joint");
    v.Check("monitor tilt limits = spec.tilt_deg", Near(tilt.Lower, Rad(mon, "tilt_deg", 0)) && Near(tilt.Upper, Rad(mon, "tilt_deg", 1)));
    var swivel = urdf.Joint("monitor_swivel_joint");
    v.Check("monitor swivel limits = spec.swivel_deg", Near(swivel.Lower, Rad(mon, "swivel_deg", 0)) && Near(swivel.Upper, Rad(mon, "swivel_deg", 1)));
    double heavy = tag == "concept" ? mon.GetProperty("tube_mass_kg").GetDouble() : spec.GetProperty("build").GetProperty("panel").GetProperty("mass_kg").GetDouble();
    v.Check($"monitor body carries the {heavy} kg {(tag == "concept" ? "CRT" : "LCD panel")}", urdf.Links.First(l => l.Name == "monitor_body").Mass > heavy);

    v.Section("USDA vs URDF");
    v.Check("stage: upAxis Z, metersPerUnit 1, kilogramsPerUnit 1", usd.UpAxis == "Z" && usd.MetersPerUnit == 1 && usd.KgPerUnit == 1);
    var massive = urdf.Links.Where(l => l.Mass is not null).ToList();
    v.Check($"same rigid bodies ({usd.Masses.Count} / {massive.Count})", usd.Masses.Count == massive.Count && massive.All(l => usd.Masses.ContainsKey(l.Name)));
    double worst = massive.Where(l => usd.Masses.ContainsKey(l.Name)).Select(l => Math.Abs(usd.Masses[l.Name] - l.Mass!.Value) / l.Mass.Value).DefaultIfEmpty(1).Max();
    v.Check($"masses agree (worst relative difference {worst:E1})", worst < 1e-5);
    v.Check($"same joints ({usd.Joints.Count} / {urdf.Joints.Count})", usd.Joints.Count == urdf.Joints.Count && urdf.Joints.All(j => usd.Joints.ContainsKey(j.Name)));
    bool typesOk = true, limitsOk = true, bodiesOk = true;
    foreach (var j in urdf.Joints)
    {
        if (!usd.Joints.TryGetValue(j.Name, out var u)) continue;
        string want = j.Type switch { "fixed" => "PhysicsFixedJoint", "prismatic" => "PhysicsPrismaticJoint", _ => "PhysicsRevoluteJoint" };
        typesOk &= u.Type == want;
        bodiesOk &= u.Body1 == j.Child && (j.Parent == "desk" ? u.Body0 is null : u.Body0 == j.Parent);
        if (j.Type == "revolute") limitsOk &= Near(u.Lower!.Value, j.Lower * 180 / Math.PI, 1e-3) && Near(u.Upper!.Value, j.Upper * 180 / Math.PI, 1e-3);
        if (j.Type == "prismatic") limitsOk &= Near(u.Lower!.Value, j.Lower) && Near(u.Upper!.Value, j.Upper);
    }
    v.Check("joint types match", typesOk);
    v.Check("joint bodies match parent/child (world-fixed roots have no body0)", bodiesOk);
    v.Check("joint limits match (USD degrees vs URDF radians)", limitsOk);
    v.Check($"articulation roots on the world-fixed joints ({usd.ArticulationRoots})", usd.ArticulationRoots == urdf.Joints.Count(j => j.Parent == "desk"));

    v.Section("STEP (AP214)");
    var step = File.ReadAllText(Path.Combine(outDir, "pastella84.step"));
    var parts = report.GetProperty("parts").EnumerateArray().Select(p => p.GetProperty("name").GetString()!).ToList();
    v.Check("schema AUTOMOTIVE_DESIGN (AP214)", step.Contains("FILE_SCHEMA(('AUTOMOTIVE_DESIGN"));
    v.Check("units: millimetre", step.Contains("SI_UNIT(.MILLI.,.METRE.)"));
    var solidNames = Regex.Matches(step, @"MANIFOLD_SOLID_BREP\('([^']*)'").Select(m => m.Groups[1].Value).ToList();
    int solidsExpected = report.GetProperty("counts").GetProperty("solids").GetInt32();
    var nameSet = solidNames.ToHashSet();
    v.Check($"named solids for every part ({solidNames.Count} solids / {solidsExpected} expected, {parts.Count} parts)",
        solidNames.Count == solidsExpected && parts.All(p => nameSet.Contains(p) || nameSet.Contains(p + "_0")));
    v.Check("every solid has a colour (STYLED_ITEM)", Regex.Matches(step, @"= STYLED_ITEM\(").Count == solidNames.Count);
    var defined = new HashSet<int>(Regex.Matches(step, @"^#(\d+) =", RegexOptions.Multiline).Select(m => int.Parse(m.Groups[1].Value)));
    var referenced = Regex.Matches(step, @"#(\d+)").Select(m => int.Parse(m.Groups[1].Value)).Distinct();
    v.Check("all entity references resolve", referenced.All(defined.Contains));

    v.Section("GLB (web)");
    var glb = Glb.Load(Path.Combine(outDir, "web", "pastella84.glb"));
    v.Check("glTF 2.0 binary, JSON + BIN chunks", glb.Ok);
    v.Check($"one node per part ({parts.Count(glb.NodeNames.Contains)} / {parts.Count})", parts.All(glb.NodeNames.Contains));
    v.Check("link nodes for every URDF link", urdf.Links.All(l => glb.NodeNames.Contains("link:" + l.Name)));

    v.Section("web data");
    var cadJs = File.ReadAllText(Path.Combine(root, "src", "js", "data", "cad.js"));
    v.Check("src/js/data/cad.js points at this GLB and matches report revision", cadJs.Contains(rel + "/web/pastella84.glb") && cadJs.Contains($"\"revision\": \"{report.GetProperty("revision").GetString()}\""));
}

// ---- build variant: printed pieces, BOM, DXF
{
    v.Prefix = "build · ";
    var bdir = Path.Combine(root, "cad", "out", "build");
    var report = JsonDocument.Parse(File.ReadAllText(Path.Combine(bdir, "report.json"))).RootElement;
    var b = spec.GetProperty("build");
    var bed = b.GetProperty("printer").GetProperty("bed").EnumerateArray().Select(x => x.GetDouble()).ToArray();
    double margin = b.GetProperty("printer").GetProperty("margin").GetDouble();
    var pieces = report.GetProperty("fab").GetProperty("plan").GetProperty("pieces").EnumerateArray().ToList();
    v.Section("3D print pieces (STL)");
    int ok = 0;
    foreach (var pc in pieces)
    {
        var f = Path.Combine(bdir, "print", pc.GetProperty("file").GetString()!);
        if (!File.Exists(f)) { v.Check($"{f} exists", false); continue; }
        var (tris, closed, finite) = Stl.Inspect(f);
        var (lo, hi) = Stl.Bounds(f);
        bool fits = hi[0] - lo[0] <= bed[0] - 2 * margin + 1e-3 && hi[1] - lo[1] <= bed[1] - 2 * margin + 1e-3 && hi[2] - lo[2] <= bed[2] + 1e-3;
        bool onBed = Math.Abs(lo[2]) < 1e-3;
        v.Check($"{pc.GetProperty("file").GetString()}: watertight, finite", closed && finite && tris > 0, quiet: true);
        v.Check($"{pc.GetProperty("file").GetString()}: fits the {bed[0]} mm bed, lies on it", fits && onBed, quiet: true);
        if (closed && finite && fits && onBed) ok++;
    }
    v.Check($"{ok} / {pieces.Count} pieces: watertight, fit the bed, lie on it", ok == pieces.Count && pieces.Count > 0);
    v.Check("every split seam has joints (housings)", report.GetProperty("fab").GetProperty("plan").GetProperty("seams").EnumerateArray()
        .Where(sm => !sm.GetProperty("group").GetString()!.StartsWith("stand") && !sm.GetProperty("group").GetString()!.StartsWith("m"))
        .All(sm => sm.GetProperty("joints").GetInt32() > 0));
    v.Check("print plan has no errors", report.GetProperty("fab").GetProperty("plan").GetProperty("errors").GetArrayLength() == 0);
    v.Section("BOM · DXF");
    var bom = File.ReadAllLines(Path.Combine(bdir, "bom.csv")).Skip(1).ToList();
    int Qty(string key) => bom.Where(l => l.Contains(key)).Select(l => int.Parse(l[(l.LastIndexOf(',') + 1)..])).Sum();
    v.Check("bom.csv lists the LCD panel and its controller board", Qty("M190PW01") >= 2);
    v.Check($"bom.csv: one MX switch per key ({Qty("MX 호환 스위치")} / {keysTotal})", Qty("MX 호환 스위치") == keysTotal);
    v.Check($"bom.csv: keycaps for every key ({Qty("키캡 PBT")} / {keysTotal})", Qty("키캡 PBT") == keysTotal);
    v.Check($"bom.csv: heat-set inserts listed ({Qty("열압입 인서트")})", Qty("열압입 인서트") > 0);
    v.Check("bom.csv lists every printed piece", pieces.All(pc => bom.Any(l => l.Contains(pc.GetProperty("file").GetString()!))));
    var dxf = File.ReadAllText(Path.Combine(bdir, "fab", "kb_plate.dxf"));
    int cut = Regex.Matches(dxf, "8\nCUTOUT\n66").Count, holes = Regex.Matches(dxf, "0\nCIRCLE\n").Count;
    v.Check($"kb_plate.dxf: outline, {cut} switch/stabiliser cut-outs (>= {keysTotal}), {holes} screw holes", dxf.Contains("OUTLINE") && cut >= keysTotal && holes == 4 && dxf.TrimEnd().EndsWith("EOF"));
    v.Check("print-plan.md present", File.Exists(Path.Combine(bdir, "print-plan.md")));
}

var md = v.Markdown(root);
File.WriteAllText(Path.Combine(root, "cad", "out", "validation.md"), md);
Console.WriteLine(v.Summary());
return v.Failed == 0 ? 0 : 1;

static string? Arg(string name) { var a = Environment.GetCommandLineArgs(); var i = Array.IndexOf(a, name); return i >= 0 && i + 1 < a.Length ? a[i + 1] : null; }
static string FindRoot()
{
    var d = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (d is not null && !File.Exists(Path.Combine(d.FullName, "cad", "spec.json"))) d = d.Parent;
    return d?.FullName ?? throw new Exception("run inside the repository (cad/spec.json not found)");
}
static bool Near(double a, double b, double tol = 1e-6) => Math.Abs(a - b) <= tol;
static double Rad(JsonElement e, string key, int i) => e.GetProperty(key)[i].GetDouble() * Math.PI / 180;

sealed class Validator
{
    readonly List<(string Section, string Name, bool Ok)> rows = new();
    string section = "";
    public string Prefix = "";
    public int Failed => rows.Count(r => !r.Ok);
    public void Section(string s) => section = Prefix + s;
    public void Check(string name, bool ok, bool quiet = false)
    {
        if (!quiet || !ok) rows.Add((section, name, ok));
        if (!ok) Console.Error.WriteLine($"FAIL [{section}] {name}");
    }
    public string Summary() => $"Pastella.Validate: {rows.Count(r => r.Ok)} passed, {Failed} failed -> cad/out/validation.md";
    public string Markdown(string root)
    {
        var sb = new StringBuilder("# CAD 출력 검증 결과 (C# Pastella.Validate)\n\n");
        sb.Append("`cad/rust`가 만든 산출물을 C#에서 다시 읽어 서로 교차 검증한 결과입니다. 자동 생성 파일입니다.\n\n");
        sb.Append(Failed == 0 ? "**결과: 모두 통과**\n" : $"**결과: {Failed}건 실패**\n");
        foreach (var g in rows.GroupBy(r => r.Section))
        {
            sb.Append($"\n## {g.Key}\n\n");
            foreach (var r in g) sb.Append($"- [{(r.Ok ? "x" : " ")}] {r.Name}\n");
        }
        return sb.ToString();
    }
}

sealed record UrdfLink(string Name, double? Mass, double[,]? Inertia, List<string> Meshes);
sealed record UrdfJoint(string Name, string Type, string Parent, string Child, double[] Axis, double Lower, double Upper);

sealed class Urdf
{
    public List<UrdfLink> Links = new();
    public List<UrdfJoint> Joints = new();
    public bool Has(string n) => Links.Any(l => l.Name == n);
    public UrdfJoint Joint(string n) => Joints.First(j => j.Name == n);
    public HashSet<string> Reachable(string from)
    {
        var seen = new HashSet<string> { from };
        var stack = new Stack<string>(new[] { from });
        while (stack.Count > 0)
        {
            var cur = stack.Pop();
            foreach (var j in Joints.Where(j => j.Parent == cur))
                if (seen.Add(j.Child)) stack.Push(j.Child);
        }
        return seen;
    }
    static double D(XAttribute? a) => a is null ? 0 : double.Parse(a.Value, CultureInfo.InvariantCulture);
    public static Urdf Load(string path)
    {
        var x = XDocument.Load(path).Root!;
        var u = new Urdf();
        foreach (var l in x.Elements("link"))
        {
            var inr = l.Element("inertial");
            double[,]? I = null;
            if (inr is not null)
            {
                var i = inr.Element("inertia")!;
                double xx = D(i.Attribute("ixx")), xy = D(i.Attribute("ixy")), xz = D(i.Attribute("ixz")), yy = D(i.Attribute("iyy")), yz = D(i.Attribute("iyz")), zz = D(i.Attribute("izz"));
                I = new[,] { { xx, xy, xz }, { xy, yy, yz }, { xz, yz, zz } };
            }
            u.Links.Add(new UrdfLink(l.Attribute("name")!.Value, inr is null ? null : D(inr.Element("mass")!.Attribute("value")), I,
                l.Elements("visual").Select(vv => vv.Element("geometry")!.Element("mesh")!.Attribute("filename")!.Value).ToList()));
        }
        foreach (var j in x.Elements("joint"))
        {
            var axis = j.Element("axis")?.Attribute("xyz")?.Value.Split(' ').Select(s => double.Parse(s, CultureInfo.InvariantCulture)).ToArray() ?? new[] { 1.0, 0, 0 };
            var lim = j.Element("limit");
            u.Joints.Add(new UrdfJoint(j.Attribute("name")!.Value, j.Attribute("type")!.Value, j.Element("parent")!.Attribute("link")!.Value,
                j.Element("child")!.Attribute("link")!.Value, axis, D(lim?.Attribute("lower")), D(lim?.Attribute("upper"))));
        }
        return u;
    }
}

sealed record UsdJoint(string Type, string? Body0, string? Body1, double? Lower, double? Upper);

sealed class Usda
{
    public string UpAxis = "";
    public double MetersPerUnit, KgPerUnit;
    public int ArticulationRoots;
    public Dictionary<string, double> Masses = new();
    public Dictionary<string, UsdJoint> Joints = new();
    public static Usda Load(string path)
    {
        var t = File.ReadAllText(path);
        var u = new Usda
        {
            UpAxis = Regex.Match(t, "upAxis = \"(\\w)\"").Groups[1].Value,
            MetersPerUnit = double.Parse(Regex.Match(t, @"metersPerUnit = ([\d.]+)").Groups[1].Value, CultureInfo.InvariantCulture),
            KgPerUnit = double.Parse(Regex.Match(t, @"kilogramsPerUnit = ([\d.]+)").Groups[1].Value, CultureInfo.InvariantCulture),
            ArticulationRoots = Regex.Matches(t, "PhysicsArticulationRootAPI").Count,
        };
        // rigid bodies: Xform prims that apply PhysicsMassAPI, mass stated before their meshes
        foreach (Match m in Regex.Matches(t, "def Xform \"(\\w+)\" \\(\\s*prepend apiSchemas = \\[\"PhysicsRigidBodyAPI\", \"PhysicsMassAPI\"\\]\\s*\\)\\s*\\{[^{]*?float physics:mass = ([-\\d.eE+]+)"))
            u.Masses[m.Groups[1].Value] = double.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
        var joints = t[t.IndexOf("def Scope \"joints\"", StringComparison.Ordinal)..];
        var blocks = Regex.Matches(joints, "def (Physics\\w+Joint) \"(\\w+)\"");
        for (int i = 0; i < blocks.Count; i++)
        {
            int end = i + 1 < blocks.Count ? blocks[i + 1].Index : joints.Length;
            var b = joints[blocks[i].Index..end];
            string? Rel(string k) { var m = Regex.Match(b, $"rel physics:{k} = </Pastella84/(\\w+)>"); return m.Success ? m.Groups[1].Value : null; }
            double? F(string k) { var m = Regex.Match(b, $"float physics:{k} = ([-\\d.eE+]+)"); return m.Success ? double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) : null; }
            u.Joints[blocks[i].Groups[2].Value] = new UsdJoint(blocks[i].Groups[1].Value, Rel("body0"), Rel("body1"), F("lowerLimit"), F("upperLimit"));
        }
        return u;
    }
}

static class Stl
{
    public static (double[], double[]) Bounds(string path)
    {
        var b = File.ReadAllBytes(path);
        int n = BitConverter.ToInt32(b, 80);
        var lo = new[] { double.MaxValue, double.MaxValue, double.MaxValue }; var hi = new[] { double.MinValue, double.MinValue, double.MinValue };
        for (int i = 0; i < n; i++) for (int k = 0; k < 3; k++) for (int a = 0; a < 3; a++)
        {
            double x = BitConverter.ToSingle(b, 84 + i * 50 + 12 + k * 12 + a * 4);
            lo[a] = Math.Min(lo[a], x); hi[a] = Math.Max(hi[a], x);
        }
        return (lo, hi);
    }
    /// Binary STL: (triangles, watertight after welding, size consistent + finite)
    public static (int, bool, bool) Inspect(string path)
    {
        var b = File.ReadAllBytes(path);
        int n = BitConverter.ToInt32(b, 80);
        bool sizeOk = b.Length == 84 + n * 50;
        var verts = new Dictionary<(long, long, long), int>();
        var edges = new Dictionary<(int, int), int>();
        bool finite = sizeOk;
        for (int i = 0; sizeOk && i < n; i++)
        {
            var id = new int[3];
            for (int k = 0; k < 3; k++)
            {
                int o = 84 + i * 50 + 12 + k * 12;
                float x = BitConverter.ToSingle(b, o), y = BitConverter.ToSingle(b, o + 4), z = BitConverter.ToSingle(b, o + 8);
                finite &= float.IsFinite(x) && float.IsFinite(y) && float.IsFinite(z);
                var key = ((long)Math.Round(x * 1e6), (long)Math.Round(y * 1e6), (long)Math.Round(z * 1e6));
                if (!verts.TryGetValue(key, out id[k])) verts[key] = id[k] = verts.Count;
            }
            for (int k = 0; k < 3; k++)
            {
                int a = id[k], c = id[(k + 1) % 3];
                var e = a < c ? (a, c) : (c, a);
                edges[e] = edges.GetValueOrDefault(e) + 1;
            }
        }
        return (n, sizeOk && edges.Values.All(c => c % 2 == 0), finite);
    }
}

sealed class Glb
{
    public bool Ok;
    public HashSet<string> NodeNames = new();
    public static Glb Load(string path)
    {
        var b = File.ReadAllBytes(path);
        var g = new Glb();
        if (b.Length < 28 || Encoding.ASCII.GetString(b, 0, 4) != "glTF" || BitConverter.ToUInt32(b, 4) != 2 || BitConverter.ToUInt32(b, 8) != b.Length) return g;
        int jl = BitConverter.ToInt32(b, 12);
        if (Encoding.ASCII.GetString(b, 16, 4) != "JSON") return g;
        var doc = JsonDocument.Parse(Encoding.UTF8.GetString(b, 20, jl)).RootElement;
        int bo = 20 + jl;
        g.Ok = Encoding.ASCII.GetString(b, bo + 4, 4) == "BIN\0" && doc.GetProperty("asset").GetProperty("version").GetString() == "2.0";
        foreach (var n in doc.GetProperty("nodes").EnumerateArray()) if (n.TryGetProperty("name", out var nm)) g.NodeNames.Add(nm.GetString()!);
        return g;
    }
}

static class Linalg
{
    public static double Norm(double[] a) => Math.Sqrt(a.Sum(x => x * x));
    /// Eigenvalues of a symmetric 3x3 matrix (cyclic Jacobi), ascending.
    public static double[] EigSym(double[,] m)
    {
        var a = (double[,])m.Clone();
        for (int sweep = 0; sweep < 50; sweep++)
        {
            double off = Math.Abs(a[0, 1]) + Math.Abs(a[0, 2]) + Math.Abs(a[1, 2]);
            if (off < 1e-18) break;
            for (int p = 0; p < 2; p++)
                for (int q = p + 1; q < 3; q++)
                {
                    if (Math.Abs(a[p, q]) < 1e-300) continue;
                    double th = 0.5 * Math.Atan2(2 * a[p, q], a[q, q] - a[p, p]), c = Math.Cos(th), s = Math.Sin(th);
                    for (int k = 0; k < 3; k++) { double akp = a[k, p], akq = a[k, q]; a[k, p] = c * akp - s * akq; a[k, q] = s * akp + c * akq; }
                    for (int k = 0; k < 3; k++) { double apk = a[p, k], aqk = a[q, k]; a[p, k] = c * apk - s * aqk; a[q, k] = s * apk + c * aqk; }
                }
        }
        return new[] { a[0, 0], a[1, 1], a[2, 2] }.OrderBy(x => x).ToArray();
    }
}
