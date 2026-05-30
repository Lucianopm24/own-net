const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const zlib = require("zlib")
const { v4: uuidv4 } = require("uuid")

const app = express()

app.use(cors())

app.use(express.json({
    limit: "50mb"
}))

// =========================
// CONFIG
// =========================

const JWT_SECRET =
    process.env.JWT_SECRET

const LUCKS_API_KEY =
    process.env.LUCKS_API_KEY

const DOMAIN_PRICE = 100

// =========================
// MONGO
// =========================

mongoose.connect(
    process.env.MONGO_URI
)

mongoose.connection.once(
    "open",
    () => {
        console.log(
            "Mongo connected"
        )
    }
)

// =========================
// MODELS
// =========================

// =========================
// MODELS
// =========================

const KVSchema = new mongoose.Schema({
  project: String,
  key: String,
  value: String,
  size: Number,
  owner: String,
  updatedAt: { type: Date, default: Date.now }
})
KVSchema.index({ project: 1, key: 1 }, { unique: true })

const KVProjectSchema = new mongoose.Schema({
  project: { type: String, unique: true },
  extra: { type: Boolean, default: false }
})

onst EnvVarSchema = new mongoose.Schema({
  projectId: String,
  name: String,
  value: String,
  owner: String,
})
EnvVarSchema.index({ projectId: 1, name: 1 }, { unique: true })

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    lucks: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
})

const DomainSchema = new mongoose.Schema({
    domain: { type: String, unique: true },
    owner: String,
    cname: { type: String, default: null },
    mx: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
})

const UploadSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    owner: String,
    originalName: String,
    compressed: Buffer,
    createdAt: { type: Date, default: Date.now }
})

const MailAccountSchema = new mongoose.Schema({
    address: { type: String, unique: true },
    password: String,
    owner: String,
    createdAt: { type: Date, default: Date.now }
})

const MailSchema = new mongoose.Schema({
    domain: String,
    from: String,
    to: String,
    subject: String,
    body: String,
    createdAt: { type: Date, default: Date.now }
})

const SubdomainSchema = new mongoose.Schema({
    domain: String,
    subdomain: String,
    cname: { type: String, default: null },
    mx: { type: String, default: null },
    owner: String,
    createdAt: { type: Date, default: Date.now }
})
SubdomainSchema.index({ domain: 1, subdomain: 1 }, { unique: true })

const ProjectSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    owner: String,
    createdAt: { type: Date, default: Date.now }
})

const ProjectFileSchema = new mongoose.Schema({
    projectId: String,
    path: String,
    compressed: Buffer,
    updatedAt: { type: Date, default: Date.now }
})
ProjectFileSchema.index({ projectId: 1, path: 1 }, { unique: true })

const User = mongoose.models.User || mongoose.model("User", UserSchema)
const Domain = mongoose.models.Domain || mongoose.model("Domain", DomainSchema)
const UploadModel = mongoose.models.Upload || mongoose.model("Upload", UploadSchema)
const MailAccount = mongoose.models.MailAccount || mongoose.model("MailAccount", MailAccountSchema)
const Mail = mongoose.models.Mail || mongoose.model("Mail", MailSchema)
const Subdomain = mongoose.models.Subdomain || mongoose.model("Subdomain", SubdomainSchema)
const Project = mongoose.models.Project || mongoose.model("Project", ProjectSchema)
const ProjectFile = mongoose.models.ProjectFile || mongoose.model("ProjectFile", ProjectFileSchema)
const KV = mongoose.models.KV || mongoose.model("KV", KVSchema)
const KVProject = mongoose.models.KVProject || mongoose.model("KVProject", KVProjectSchema)
const EnvVar = mongoose.models.EnvVar || mongoose.model("EnvVar", EnvVarSchema)

// =========================
// AUTH
// =========================

function createToken(user) {

    return jwt.sign(

        {
            id: user._id,
            username: user.username
        },

        JWT_SECRET,

        {
            expiresIn: "30d"
        }

    )

}



async function auth(
    req,
    res,
    next
) {

    try {

        const header =
            req.headers.authorization

        if (!header)
            return res
            .status(401)
            .json({
                error: "No token"
            })

        const token =
            header.split(" ")[1]

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            )

        req.user = decoded

        next()

    } catch {

        res
        .status(401)
        .json({
            error: "Invalid token"
        })

    }

}

// =========================
// AUTH ROUTES
// =========================

app.post(
    "/auth/register",

    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body

            if (
                !username ||
                !password
            )
                return res
                .status(400)
                .json({
                    error:
                    "Missing fields"
                })

            const exists =
                await User.findOne({
                    username
                })

            if (exists)
                return res
                .status(400)
                .json({
                    error:
                    "Username taken"
                })

            const hashed =
                await bcrypt.hash(
                    password,
                    10
                )

            const user =
                await User.create({

                    username,

                    password:
                        hashed

                })

            const token =
                createToken(user)

            res.json({

                token,

                username,

                lucks: 0

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/auth/login",

    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body

            const user =
                await User.findOne({
                    username
                })

            if (!user)
                return res
                .status(404)
                .json({
                    error:
                    "User not found"
                })

            const valid =
                await bcrypt.compare(
                    password,
                    user.password
                )

            if (!valid)
                return res
                .status(400)
                .json({
                    error:
                    "Invalid password"
                })

            const token =
                createToken(user)

            res.json({

                token,

                username:
                    user.username,

                lucks:
                    user.lucks

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.get(
    "/me",
    auth,

    async (req, res) => {

        const user =
            await User.findById(
                req.user.id
            )

        res.json({

            username:
                user.username,

            lucks:
                user.lucks

        })

    }

)

// =========================
// LUCKS
// =========================

app.post(
    "/lucks/add",

    async (req, res) => {

        try {

            const apiKey =
                req.headers[
                    "x-api-key"
                ]

            if (
                apiKey !==
                LUCKS_API_KEY
            )
                return res
                .status(403)
                .json({
                    error:
                    "Invalid API key"
                })

            const {
                username,
                amount
            } = req.body

            const user =
                await User.findOne({
                    username
                })

            if (!user)
                return res
                .status(404)
                .json({
                    error:
                    "User not found"
                })

            user.lucks +=
                Number(amount)

            await user.save()

            res.json({

                success: true,

                balance:
                    user.lucks

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// DOMAINS
// =========================

app.post(
    "/domains/register",
    auth,

    async (req, res) => {

        try {

            const { domain } =
                req.body

            if (!domain)
                return res
                .status(400)
                .json({
                    error:
                    "Missing domain"
                })

            const exists =
                await Domain.findOne({
                    domain
                })

            if (exists)
                return res
                .status(400)
                .json({
                    error:
                    "Domain taken"
                })

            const allowed = [
                ".green",
                ".party",
                ".lbc",
                ".inn",
                ".abc",
                ".cc"
            ]

            const valid =
                allowed.some(
                    ext =>
                    domain.endsWith(ext)
                )

            if (!valid)
                return res
                .status(400)
                .json({
                    error:
                    "Invalid extension"
                })

            const user =
                await User.findById(
                    req.user.id
                )

            if (
                user.lucks <
                DOMAIN_PRICE
            )
                return res
                .status(400)
                .json({
                    error:
                    "Not enough lucks"
                })

            user.lucks -=
                DOMAIN_PRICE

            await user.save()

            const created =
                await Domain.create({

                    domain,

                    owner:
                        user.username

                })

            res.json(created)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/domains/cname",
    auth,

    async (req, res) => {

        try {

            const {
                domain,
                cname
            } = req.body

            const found =
                await Domain.findOne({
                    domain
                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Domain not found"
                })

            if (
                found.owner !==
                req.user.username
            )
                return res
                .status(403)
                .json({
                    error:
                    "Unauthorized"
                })

            found.cname =
                cname

            await found.save()

            res.json(found)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/domains/mx",
    auth,

    async (req, res) => {

        try {

            const {
                domain,
                mx
            } = req.body

            const found =
                await Domain.findOne({
                    domain
                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Domain not found"
                })

            if (
                found.owner !==
                req.user.username
            )
                return res
                .status(403)
                .json({
                    error:
                    "Unauthorized"
                })

            found.mx = mx

            await found.save()

            res.json(found)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

app.get("/domains/mine", auth, async (req, res) => {
  try {
    const domains = await Domain.find({ owner: req.user.username }).sort({ createdAt: -1 })
    res.json(domains)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(
    "/domains/:domain",

    async (req, res) => {

        try {

            const found =
                await Domain.findOne({

                    domain:
                    req.params.domain

                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Not found"
                })

            res.json(found)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// SEARCH ENGINE
// =========================

app.get(
    "/search",

    async (req, res) => {

        try {

            const q =
                req.query.q || ""

            const domains =
                await Domain.find({

                    domain: {
                        $regex: q,
                        $options: "i"
                    }

                }).limit(50)

            const scored =
                domains.map(domain => {

                    let score = 0

                    if (
                        domain.domain
                        .startsWith(q)
                    )
                        score += 10

                    if (
                        domain.domain
                        .includes(q)
                    )
                        score += 5

                    if (domain.cname)
                        score += 2

                    return {

                        ...domain.toObject(),

                        relevance: score

                    }

                })

            scored.sort(
                (a, b) =>
                b.relevance -
                a.relevance
            )

            res.json(scored)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// HTML HOST
// =========================

app.post(
    "/upload",
    auth,

    async (req, res) => {

        try {

            const {
                html,
                name
            } = req.body

            if (!html)
                return res
                .status(400)
                .json({
                    error:
                    "Missing HTML"
                })

            const compressed =
                zlib.gzipSync(
                    Buffer.from(html)
                )

            const id =
                uuidv4()

            await UploadModel.create({

                id,

                owner:
                    req.user.username,

                originalName:
                    name || "index.html",

                compressed

            })

            res.json({

                success: true,

                id,

                url:
                `/upload/${id}`

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.get(
    "/upload/:id",

    async (req, res) => {

        try {

            const upload =
                await UploadModel.findOne({

                    id:
                    req.params.id

                })

            if (!upload)
                return res
                .status(404)
                .send("Not found")

            const decompressed =
                zlib.gunzipSync(
                    upload.compressed
                )

            res.setHeader(
                "Content-Type",
                "text/html"
            )

            res.send(
                decompressed
            )

        } catch (e) {

            res
            .status(500)
            .send(e.message)

        }

    }

)

// =========================
// MAIL SYSTEM
// =========================

app.post(
    "/mail/create",
    auth,

    async (req, res) => {

        try {

            const {
                address,
                password
            } = req.body

            if (
                !address ||
                !password
            )
                return res
                .status(400)
                .json({
                    error:
                    "Missing fields"
                })

            const exists =
                await MailAccount.findOne({
                    address
                })

            if (exists)
                return res
                .status(400)
                .json({
                    error:
                    "Already exists"
                })

            const domain =
                address.split("@")[1]

            const domainData =
                await Domain.findOne({
                    domain
                })

            if (!domainData)
                return res
                .status(404)
                .json({
                    error:
                    "Domain not found"
                })

            if (!domainData.mx)
                return res
                .status(400)
                .json({
                    error:
                    "No MX record"
                })

            if (
                domainData.owner !==
                req.user.username
            )
                return res
                .status(403)
                .json({
                    error:
                    "Unauthorized"
                })

            const hashed =
                await bcrypt.hash(
                    password,
                    10
                )

            await MailAccount.create({

                address,

                password:
                    hashed,

                owner:
                    req.user.username

            })

            res.json({
                success: true
            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/mail/:domain/:user/send",

    async (req, res) => {

        try {

            const {
                password,
                to,
                subject,
                body
            } = req.body

            const address =
                `${req.params.user}@${req.params.domain}`

            const account =
                await MailAccount.findOne({
                    address
                })

            if (!account)
                return res
                .status(404)
                .json({
                    error:
                    "Mail account not found"
                })

            const valid =
                await bcrypt.compare(
                    password,
                    account.password
                )

            if (!valid)
                return res
                .status(403)
                .json({
                    error:
                    "Invalid password"
                })

            const created =
                await Mail.create({

                    domain:
                        req.params.domain,

                    from:
                        address,

                    to,

                    subject,

                    body

                })

            res.json(created)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/mail/:domain/:user/inbox",

    async (req, res) => {

        try {

            const { password } =
                req.body

            const address =
                `${req.params.user}@${req.params.domain}`

            const account =
                await MailAccount.findOne({
                    address
                })

            if (!account)
                return res
                .status(404)
                .json({
                    error:
                    "Mail account not found"
                })

            const valid =
                await bcrypt.compare(
                    password,
                    account.password
                )

            if (!valid)
                return res
                .status(403)
                .json({
                    error:
                    "Invalid password"
                })

            const inbox =
                await Mail.find({
                    to: address
                }).sort({
                    createdAt: -1
                })

            res.json(inbox)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// DOMAIN RESOLVER
// =========================

app.get(
    "/resolve/:domain",

    async (req, res) => {

        try {

            const found =
                await Domain.findOne({

                    domain:
                    req.params.domain

                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Not found"
                })

            res.json({

                domain:
                    found.domain,

                owner:
                    found.owner,

                cname:
                    found.cname,

                mx:
                    found.mx

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

const fetch = require("node-fetch")

app.get("/proxy", async (req, res) => {
  try {
    const url = req.query.url
    if (!url) return res.status(400).json({ error: "Missing url" })

    // Solo permite URLs que sean CNAMEs registrados
    const allDomains = await Domain.find({ cname: { $ne: null } })
    const allowed = allDomains.some(d => url.startsWith(d.cname))
    if (!allowed) return res.status(403).json({ error: "URL not allowed" })

    const response = await fetch(url)
    const html = await response.text()

    res.setHeader("Content-Type", "text/html")
    res.setHeader("X-Frame-Options", "SAMEORIGIN")
    res.send(html)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Crear subdominio
app.post("/domains/sub", auth, async (req, res) => {
  try {
    const { domain, subdomain, cname, mx } = req.body
    if (!domain || !subdomain)
      return res.status(400).json({ error: "Missing fields" })

    const parentDomain = await Domain.findOne({ domain })
    if (!parentDomain)
      return res.status(404).json({ error: "Parent domain not found" })
    if (parentDomain.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    const exists = await Subdomain.findOne({ domain, subdomain })
    if (exists)
      return res.status(400).json({ error: "Subdomain already exists" })

    const created = await Subdomain.create({
      domain, subdomain,
      cname: cname || null,
      mx: mx || null,
      owner: req.user.username
    })
    res.json(created)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Listar subdominios de un dominio
app.get("/domains/:domain/subs", async (req, res) => {
  try {
    const subs = await Subdomain.find({ domain: req.params.domain })
    res.json(subs)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Actualizar subdominio
app.put("/domains/sub", auth, async (req, res) => {
  try {
    const { domain, subdomain, cname, mx } = req.body
    const found = await Subdomain.findOne({ domain, subdomain })
    if (!found)
      return res.status(404).json({ error: "Subdomain not found" })
    if (found.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    if (cname !== undefined) found.cname = cname
    if (mx !== undefined) found.mx = mx
    await found.save()
    res.json(found)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Eliminar subdominio
app.delete("/domains/sub", auth, async (req, res) => {
  try {
    const { domain, subdomain } = req.body
    const found = await Subdomain.findOne({ domain, subdomain })
    if (!found)
      return res.status(404).json({ error: "Subdomain not found" })
    if (found.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    await found.deleteOne()
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Resolver subdominio
app.get("/resolve/sub/:subdomain.:domain", async (req, res) => {
  try {
    const { subdomain, domain } = req.params
    const found = await Subdomain.findOne({ domain, subdomain })
    if (!found)
      return res.status(404).json({ error: "Not found" })

    res.json({
      full: `${subdomain}.${domain}`,
      domain, subdomain,
      owner: found.owner,
      cname: found.cname,
      mx: found.mx
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Crear proyecto
app.post("/projects", auth, async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: "Missing name" })

    const id = uuidv4()
    const project = await Project.create({
      id, name, owner: req.user.username
    })
    res.json(project)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Listar proyectos del usuario
app.get("/projects", auth, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user.username })
      .sort({ createdAt: -1 })
    res.json(projects)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Subir/sobreescribir archivo en proyecto
app.post("/projects/:id/files", auth, async (req, res) => {
  try {
    const { path: filePath, html } = req.body
    if (!filePath || !html)
      return res.status(400).json({ error: "Missing path or html" })

    const project = await Project.findOne({ id: req.params.id })
    if (!project)
      return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    const compressed = zlib.gzipSync(Buffer.from(html))

    await ProjectFile.findOneAndUpdate(
      { projectId: req.params.id, path: filePath },
      { compressed, updatedAt: new Date() },
      { upsert: true, new: true }
    )

    res.json({
      success: true,
      url: `/projects/${req.params.id}/${filePath}`
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Listar archivos de un proyecto
app.get("/projects/:id/files", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id })
    if (!project)
      return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    const files = await ProjectFile.find(
      { projectId: req.params.id },
      { path: 1, updatedAt: 1, _id: 0 }
    )
    res.json({ project, files })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Servir archivo de proyecto (público)
app.get("/projects/:id/*", async (req, res) => {
  try {
    const filePath = req.params[0] || "index.html"
    const file = await ProjectFile.findOne({
      projectId: req.params.id,
      path: filePath
    })

    if (!file) {
      // Intentar index.html si la ruta no tiene extensión
      const fallback = await ProjectFile.findOne({
        projectId: req.params.id,
        path: filePath.replace(/\/?$/, "/index.html").replace(/^\//, "")
      })
      if (!fallback) return res.status(404).send("Not found")
      const html = zlib.gunzipSync(fallback.compressed)
      res.setHeader("Content-Type", "text/html")
      return res.send(html)
    }

    const decompressed = zlib.gunzipSync(file.compressed)
    const ext = filePath.split(".").pop().toLowerCase()
    const types = {
      html: "text/html", css: "text/css",
      js: "application/javascript", json: "application/json",
      svg: "image/svg+xml", txt: "text/plain"
    }
    res.setHeader("Content-Type", types[ext] || "text/plain")
    res.send(decompressed)
  } catch (e) {
    res.status(500).send(e.message)
  }
})

// Eliminar proyecto completo
app.delete("/projects/:id", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id })
    if (!project)
      return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    await ProjectFile.deleteMany({ projectId: req.params.id })
    await project.deleteOne()
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Eliminar archivo específico
app.delete("/projects/:id/files/:path(*)", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id })
    if (!project)
      return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username)
      return res.status(403).json({ error: "Unauthorized" })

    await ProjectFile.deleteOne({
      projectId: req.params.id,
      path: req.params.path
    })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/lucks/transfer", auth, async (req, res) => {
  try {
    const { to, amount } = req.body

    if (!to || !amount || amount <= 0)
      return res.status(400).json({ error: "Missing fields" })

    if (to === req.user.username)
      return res.status(400).json({ error: "Can't transfer to yourself" })

    const sender = await User.findById(req.user.id)
    const receiver = await User.findOne({ username: to })

    if (!receiver)
      return res.status(404).json({ error: "User not found" })

    if (sender.lucks < amount)
      return res.status(400).json({ error: "Not enough lucks" })

    sender.lucks -= Number(amount)
    receiver.lucks += Number(amount)

    await sender.save()
    await receiver.save()

    res.json({ success: true, balance: sender.lucks })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /kv/:project/size — uso actual
app.get("/kv/:project/size", async (req, res) => {
  const total = await KV.aggregate([
    { $match: { project: req.params.project } },
    { $group: { _id: null, total: { $sum: "$size" } } }
  ])
  const extra = await KVProject.findOne({ project: req.params.project })
  const limit = extra?.extra ? 1024 * 1024 : 100 * 1024
  res.json({ used: total[0]?.total || 0, limit, unit: "bytes" })
})

// GET /kv/:project/:key — leer valor
app.get("/kv/:project/:key", async (req, res) => {
  const entry = await KV.findOne({ project: req.params.project, key: req.params.key })
  if (!entry) return res.status(404).json({ error: "Not found" })
  res.json({ key: entry.key, value: entry.value })
})

// POST /kv/:project/:key — escribir valor
app.post("/kv/:project/:key", async (req, res) => {
  const { value } = req.body
  const project = await Project.findOne({ id: req.params.project })
  if (!project) return res.status(404).json({ error: "Project not found" })

  const size = Buffer.byteLength(JSON.stringify(value))
  const total = await KV.aggregate([
    { $match: { project: req.params.project } },
    { $group: { _id: null, total: { $sum: "$size" } } }
  ])
  const used = total[0]?.total || 0
  const extra = await KVProject.findOne({ project: req.params.project })
  const limit = extra?.extra ? 1024 * 1024 : 100 * 1024
  if (used + size > limit) return res.status(400).json({ error: "Storage limit exceeded" })

  await KV.findOneAndUpdate(
    { project: req.params.project, key: req.params.key },
    { value: JSON.stringify(value), size, owner: project.owner },
    { upsert: true, new: true }
  )
  res.json({ success: true })
})

app.delete("/kv/:project/:key", async (req, res) => {
  const referer = req.headers.referer || ""
  const project = await Project.findOne({ id: req.params.project })
  if (!project) return res.status(404).json({ error: "Project not found" })
  if (!referer.includes(`/projects/${req.params.project}`))
    return res.status(403).json({ error: "Unauthorized" })
  await KV.deleteOne({ project: req.params.project, key: req.params.key })
  res.json({ success: true })
})

// Crear/actualizar env var
app.post("/projects/:id/env", auth, async (req, res) => {
  try {
    const { name, value } = req.body
    const project = await Project.findOne({ id: req.params.id })
    if (!project) return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    await EnvVar.findOneAndUpdate(
      { projectId: req.params.id, name },
      { value, owner: req.user.username },
      { upsert: true, new: true }
    )
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Listar nombres (sin valores)
app.get("/projects/:id/env", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id })
    if (!project) return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    const vars = await EnvVar.find({ projectId: req.params.id }, { name: 1, _id: 0 })
    res.json(vars)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Borrar env var
app.delete("/projects/:id/env/:name", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id })
    if (!project) return res.status(404).json({ error: "Project not found" })
    if (project.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    await EnvVar.deleteOne({ projectId: req.params.id, name: req.params.name })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ENV PROXY — el corazón del sistema
app.post("/env-proxy/:project/kv/:key", async (req, res) => {
  try {
    const { value } = req.body
    const envName = req.headers["x-env"]
    if (!envName) return res.status(400).json({ error: "Missing x-env header" })

    // Busca la env var en la DB
    const envVar = await EnvVar.findOne({ projectId: req.params.project, name: envName })
    if (!envVar) return res.status(403).json({ error: "Env var not found" })

    // Valida tamaño
    const size = Buffer.byteLength(JSON.stringify(value))
    const total = await KV.aggregate([
      { $match: { project: req.params.project } },
      { $group: { _id: null, total: { $sum: "$size" } } }
    ])
    const used = total[0]?.total || 0
    const extra = await KVProject.findOne({ project: req.params.project })
    const limit = extra?.extra ? 1024 * 1024 : 100 * 1024
    if (used + size > limit) return res.status(400).json({ error: "Storage limit exceeded" })

    // Hace la operación él mismo
    await KV.findOneAndUpdate(
      { project: req.params.project, key: req.params.key },
      { value: JSON.stringify(value), size, owner: envVar.owner },
      { upsert: true, new: true }
    )
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// =========================
// HEALTH
// =========================

app.get("/", (req, res) => {

    res.json({

        name:
        "Luciano Web Backend",

        online: true,

        version: "1.0"

    })

})

// =========================
// EXPORT FOR VERCEL
// =========================

module.exports = app
