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

const TLDSchema = new mongoose.Schema({
  tld: { type: String, unique: true }
})
const TLD = mongoose.models.TLD || mongoose.model("TLD", TLDSchema)

// Inicializar TLDs por defecto si no existen
async function initTLDs() {
  const count = await TLD.countDocuments()
  if (count === 0) {
    await TLD.insertMany([
      { tld: ".green" }, { tld: ".party" }, { tld: ".lbc" },
      { tld: ".inn" }, { tld: ".abc" }, { tld: ".cc" }
    ])
  }
}
mongoose.connection.once("open", () => { console.log("Mongo connected"); initTLDs() })

// =========================
// MONGO
// =========================

mongoose.connect(
    process.env.MONGO_URI
)

// =========================
// MODELS
// =========================

// =========================
// MODELS
// =========================

const OAuthCodeSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  projectId: String,
  username: String,
  scope: String,
  redirect: String,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 5 * 60 * 1000) }
})

const AdViewSchema = new mongoose.Schema({
  ip: String,
  targetUser: String,
  type: String,
  date: String,
  code: { type: String, default: null }
})
AdViewSchema.index({ ip: 1, targetUser: 1, type: 1, date: 1 })

const AdConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: Number
})

const AdAccountSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  balance: { type: Number, default: 0 }
})

const AdSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  owner: String,
  type: { type: String, enum: ["text", "image", "video", "link"] },
  content: String,
  title: String,
  budget: Number,
  spent: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "paused", "depleted"], default: "active" },
  createdAt: { type: Date, default: Date.now }
})

const OAuthTokenSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  projectId: String,
  username: String,
  scope: String,
  createdAt: { type: Date, default: Date.now }
})

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

const EnvVarSchema = new mongoose.Schema({
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
    ssl: { type: String, enum: [null, "self", "popular", "trusted"], default: null },
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
const OAuthCode = mongoose.models.OAuthCode || mongoose.model("OAuthCode", OAuthCodeSchema)
const EnvVar = mongoose.models.EnvVar || mongoose.model("EnvVar", EnvVarSchema)
const OAuthToken = mongoose.models.OAuthToken || mongoose.model("OAuthToken", OAuthTokenSchema)
const AdView = mongoose.models.AdView || mongoose.model("AdView", AdViewSchema)
const AdConfig = mongoose.models.AdConfig || mongoose.model("AdConfig", AdConfigSchema)
const AdAccount = mongoose.models.AdAccount || mongoose.model("AdAccount", AdAccountSchema)
const Ad = mongoose.models.Ad || mongoose.model("Ad", AdSchema)

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

            const allowedDocs = await TLD.find()
const isTldValid = allowedDocs.some(t => domain.endsWith(t.tld))

            if (!isTldValid)
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
            domain: found.domain,
            owner: found.owner,
            cname: found.cname,
            mx: found.mx,
            ssl: found.ssl || null
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
  const f404 = await ProjectFile.findOne({ projectId: req.params.id, path: "404.html" })
  if (f404) {
    const html = zlib.gunzipSync(f404.compressed)
    res.setHeader("Content-Type", "text/html")
    return res.send(html)
  }
  const fIndex = await ProjectFile.findOne({ projectId: req.params.id, path: "index.html" })
  if (fIndex) {
    const html = zlib.gunzipSync(fIndex.compressed)
    res.setHeader("Content-Type", "text/html")
    return res.send(html)
  }
  return res.status(404).send("Not found")
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
app.post("/kv/:project/:key", auth, async (req, res) => {
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

app.delete("/kv/:project/:key", auth, async (req, res) => {
  const project = await Project.findOne({ id: req.params.project })
  if (!project) return res.status(404).json({ error: "Project not found" })
  if (project.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
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

// OAUTH
app.post("/oauth/authorize", auth, async (req, res) => {
  try {
    const { projectId, redirect, scope } = req.body
    const project = await Project.findOne({ id: projectId })
    if (!project) return res.status(404).json({ error: "App not found" })
    const code = uuidv4()
    await OAuthCode.create({ code, projectId, username: req.user.username, scope, redirect })
    res.json({ code, redirect })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/oauth/token", async (req, res) => {
  try {
    const { code, projectId } = req.body
    const entry = await OAuthCode.findOne({ code, projectId })
    if (!entry) return res.status(403).json({ error: "Invalid code" })
    if (entry.expiresAt < new Date()) {
      await OAuthCode.deleteOne({ code })
      return res.status(403).json({ error: "Code expired" })
    }
    const token = uuidv4()
    await OAuthToken.create({ token, projectId, username: entry.username, scope: entry.scope })
    await OAuthCode.deleteOne({ code })
    res.json({ token, username: entry.username, scope: entry.scope })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get("/oauth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "")
    if (!token) return res.status(401).json({ error: "No token" })
    const entry = await OAuthToken.findOne({ token })
    if (!entry) return res.status(403).json({ error: "Invalid token" })
    const user = await User.findOne({ username: entry.username }, { password: 0 })
    res.json({ username: user.username, scope: entry.scope })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/oauth/revoke", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "")
    await OAuthToken.deleteOne({ token })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PAY
app.post("/pay/request", auth, async (req, res) => {
  try {
    const { projectId, amount, reason } = req.body
    const project = await Project.findOne({ id: projectId })
    if (!project) return res.status(404).json({ error: "App not found" })
    const user = await User.findOne({ username: req.user.username })
    if (user.lucks < amount) return res.status(400).json({ error: "Insufficient funds" })
    res.json({ approved: false, message: "Pending user confirmation" })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/pay/confirm", auth, async (req, res) => {
  try {
    const { projectId, amount } = req.body
    const project = await Project.findOne({ id: projectId })
    if (!project) return res.status(404).json({ error: "App not found" })
    const sender = await User.findOne({ username: req.user.username })
    if (sender.lucks < amount) return res.status(400).json({ error: "Insufficient funds" })
    const receiverUsername = `PROJECT_${projectId}`
    await User.findOneAndUpdate({ username: req.user.username }, { $inc: { lucks: -amount } })
    await User.findOneAndUpdate(
      { username: receiverUsername },
      { $inc: { lucks: amount } },
      { upsert: true, setOnInsert: { username: receiverUsername, password: uuidv4(), lucks: 0 } }
    )
    res.json({ success: true, paid: amount })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Saldo de una app (solo el owner)
app.get("/pay/balance/:projectId", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.projectId })
    if (!project) return res.status(404).json({ error: "App not found" })
    if (project.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    const account = await User.findOne({ username: `PROJECT_${req.params.projectId}` })
    res.json({ balance: account?.lucks || 0 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Retirar lucks de una app a tu cuenta
app.post("/pay/withdraw/:projectId", auth, async (req, res) => {
  try {
    const { amount } = req.body
    const project = await Project.findOne({ id: req.params.projectId })
    if (!project) return res.status(404).json({ error: "App not found" })
    if (project.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    const appAccount = await User.findOne({ username: `PROJECT_${req.params.projectId}` })
    if (!appAccount || appAccount.lucks < amount) return res.status(400).json({ error: "Insufficient funds" })
    await User.findOneAndUpdate({ username: `PROJECT_${req.params.projectId}` }, { $inc: { lucks: -amount } })
    await User.findOneAndUpdate({ username: req.user.username }, { $inc: { lucks: amount } })
    res.json({ success: true, withdrawn: amount })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/auth/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findOne({ username: req.user.username })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(403).json({ error: "Wrong password" })
    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/pay/verify", async (req, res) => {
  try {
    const { code, projectId } = req.body
    const entry = await OAuthCode.findOne({ code, projectId })
    if (!entry) return res.status(403).json({ error: "Invalid code" })
    if (entry.expiresAt < new Date()) {
      await OAuthCode.deleteOne({ code })
      return res.status(403).json({ error: "Code expired" })
    }
    await OAuthCode.deleteOne({ code })
    res.json({ success: true, username: entry.username, amount: entry.scope })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/domains/ssl", auth, async (req, res) => {
  try {
    const { domain, ssl } = req.body
    const found = await Domain.findOne({ domain })
    if (!found) return res.status(404).json({ error: "Domain not found" })
    if (found.owner !== req.user.username && req.user.username !== "Luciano")
  return res.status(403).json({ error: "Unauthorized" })
    // Solo luciano puede asignar "trusted"
    if ((ssl === "trusted" || ssl === "popular") && req.user.username !== "Luciano")
      return res.status(403).json({ error: "Unauthorized" })
    const validSsl = [null, "self", "popular", "trusted"]
if (!validSsl.includes(ssl))
      return res.status(400).json({ error: "Invalid ssl value" })
    found.ssl = ssl
    await found.save()
    res.json(found)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ADS
function getToday() {
  return new Date().toISOString().slice(0, 10)
}

// Depositar Lucks a cuenta de ads
app.post("/adnet/deposit", auth, async (req, res) => {
  try {
    const { amount } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" })
    const user = await User.findOne({ username: req.user.username })
    if (!user || user.lucks < amount) return res.status(400).json({ error: "Insufficient funds" })
    user.lucks -= amount
    await user.save()
    await AdAccount.findOneAndUpdate(
      { username: req.user.username },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    )
    res.json({ success: true, deposited: amount })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Ver balance de ads
app.get("/adnet/account", auth, async (req, res) => {
  try {
    const account = await AdAccount.findOne({ username: req.user.username })
    res.json({ balance: account?.balance || 0 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Crear anuncio
app.post("/adnet/create", auth, async (req, res) => {
  try {
    const { type, content, title, budget } = req.body
    if (!type || !content || !budget || !title)
      return res.status(400).json({ error: "Missing fields" })
    if (!["text", "image", "video", "link"].includes(type))
      return res.status(400).json({ error: "Invalid type" })
    const account = await AdAccount.findOne({ username: req.user.username })
    if (!account || account.balance < budget)
      return res.status(400).json({ error: "Insufficient ad balance" })
    account.balance -= budget
    await account.save()
    const ad = await Ad.create({
      id: uuidv4(), owner: req.user.username,
      type, content, title, budget, spent: 0, status: "active"
    })
    res.json(ad)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Listar mis anuncios
app.get("/adnet/mine", auth, async (req, res) => {
  try {
    const ads = await Ad.find({ owner: req.user.username }).sort({ createdAt: -1 })
    res.json(ads)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Pausar/reanudar anuncio
app.post("/adnet/pause/:id", auth, async (req, res) => {
  try {
    const ad = await Ad.findOne({ id: req.params.id })
    if (!ad) return res.status(404).json({ error: "Ad not found" })
    if (ad.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    if (ad.status === "depleted") return res.status(400).json({ error: "Ad is depleted" })
    ad.status = ad.status === "active" ? "paused" : "active"
    await ad.save()
    res.json({ success: true, status: ad.status })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Borrar anuncio
app.delete("/adnet/delete/:id", auth, async (req, res) => {
  try {
    const ad = await Ad.findOne({ id: req.params.id })
    if (!ad) return res.status(404).json({ error: "Ad not found" })
    if (ad.owner !== req.user.username && req.user.username !== "Luciano")
      return res.status(403).json({ error: "Unauthorized" })
    // Devolver presupuesto restante
    const remaining = ad.budget - ad.spent
    if (remaining > 0) {
      await AdAccount.findOneAndUpdate(
        { username: ad.owner },
        { $inc: { balance: remaining } },
        { upsert: true }
      )
    }
    await ad.deleteOne()
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Servir anuncio aleatorio activo
app.get("/adnet/serve", async (req, res) => {
  try {
    const { type, id } = req.query
    if (id) {
      const ad = await Ad.findOne({ id, status: "active" })
      if (!ad) return res.status(404).json({ error: "No ads available" })
      return res.json({ id: ad.id, type: ad.type, content: ad.content, title: ad.title })
    }
    const query = { status: "active" }
    if (type) query.type = type
    const count = await Ad.countDocuments(query)
    if (!count) return res.status(404).json({ error: "No ads available" })
    const random = Math.floor(Math.random() * count)
    const ad = await Ad.findOne(query).skip(random)
    res.json({ id: ad.id, type: ad.type, content: ad.content, title: ad.title })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Ver banner — paga al owner del anuncio
app.post("/adnet/view", async (req, res) => {
  try {
    const { adId, targetUser } = req.body
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress
    if (!adId || !targetUser) return res.status(400).json({ error: "Missing fields" })

    const ad = await Ad.findOne({ id: adId, status: "active" })
    if (!ad) return res.json({ paid: false, reason: "Ad not active" })

    const user = await User.findOne({ username: targetUser })
    if (!user) return res.status(404).json({ error: "User not found" })

    const today = getToday()
    const existing = await AdView.findOne({ ip, targetUser, type: "banner", date: today })
    if (existing) return res.json({ paid: false, reason: "Already viewed today" })

    const rateDoc = await AdConfig.findOne({ key: "banner_rate" })
    const rate = rateDoc?.value ?? 0.5

    if (ad.spent + rate > ad.budget) {
      ad.status = "depleted"
      await ad.save()
      return res.json({ paid: false, reason: "Ad depleted" })
    }

    await AdView.create({ ip, targetUser, type: "banner", date: today })
    ad.spent += rate
    if (ad.spent >= ad.budget) ad.status = "depleted"
    await ad.save()
    await User.findOneAndUpdate({ username: targetUser }, { $inc: { lucks: rate } })

    res.json({ paid: true, amount: rate })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Ver rewarded — paga al targetUser con código de validación
app.post("/adnet/rewarded", async (req, res) => {
  try {
    const { adId, targetUser, redirectUri } = req.body
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress
    if (!adId || !targetUser) return res.status(400).json({ error: "Missing fields" })

    const ad = await Ad.findOne({ id: adId, status: "active" })
    if (!ad) return res.json({ paid: false, reason: "Ad not active" })

    const user = await User.findOne({ username: targetUser })
    if (!user) return res.status(404).json({ error: "User not found" })

    const today = getToday()
    const count = await AdView.countDocuments({ ip, targetUser, type: "rewarded", date: today })
    if (count >= 100) return res.json({ paid: false, reason: "Daily limit reached" })

    const rateDoc = await AdConfig.findOne({ key: "rewarded_rate" })
    const rate = rateDoc?.value ?? 0.75

    if (ad.spent + rate > ad.budget) {
      ad.status = "depleted"
      await ad.save()
      return res.json({ paid: false, reason: "Ad depleted" })
    }

    const code = uuidv4()
    await AdView.create({ ip, targetUser, type: "rewarded", date: today, code })
    ad.spent += rate
    if (ad.spent >= ad.budget) ad.status = "depleted"
    await ad.save()
    await User.findOneAndUpdate({ username: targetUser }, { $inc: { lucks: rate } })

    res.json({ paid: true, amount: rate, code, redirectUri })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Validar código rewarded
app.get("/adnet/validate/:code", async (req, res) => {
  try {
    const view = await AdView.findOne({ code: req.params.code })
    if (!view) return res.status(404).json({ valid: false })
    res.json({ valid: true, targetUser: view.targetUser, date: view.date })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Ver/cambiar config (solo Luciano)
app.get("/adnet/config", async (req, res) => {
  try {
    const banner = await AdConfig.findOne({ key: "banner_rate" })
    const rewarded = await AdConfig.findOne({ key: "rewarded_rate" })
    res.json({ banner_rate: banner?.value ?? 0.5, rewarded_rate: rewarded?.value ?? 0.75 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/adnet/config", auth, async (req, res) => {
  try {
    if (req.user.username !== "Luciano") return res.status(403).json({ error: "Unauthorized" })
    const { banner_rate, rewarded_rate } = req.body
    if (banner_rate !== undefined)
      await AdConfig.findOneAndUpdate({ key: "banner_rate" }, { value: banner_rate }, { upsert: true })
    if (rewarded_rate !== undefined)
      await AdConfig.findOneAndUpdate({ key: "rewarded_rate" }, { value: rewarded_rate }, { upsert: true })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// TELEGRAM UPLOAD
app.post("/telegram/upload", async (req, res) => {
  try {
    const { base64, filename } = req.body
    if (!base64) return res.status(400).json({ error: "Missing image" })
    
    const token = process.env.TG_BOT_TOKEN
    const chatId = process.env.TG_CHAT_ID
    
    const buffer = Buffer.from(base64, "base64")
    if (buffer.length > 4.5 * 1024 * 1024)
      return res.status(400).json({ error: "File too large (max 4.5MB)" })
    
    const FormData = require("form-data")
    const form = new FormData()
    form.append("chat_id", chatId)
    form.append("photo", buffer, { filename: filename || "image.jpg" })
    
    const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    })
    const d = await r.json()
    if (!d.ok) return res.status(500).json({ error: d.description })
    
    const fileId = d.result.photo.at(-1).file_id
    const r2 = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
    const d2 = await r2.json()
    const url = `https://api.telegram.org/file/bot${token}/${d2.result.file_path}`
    
    res.json({ success: true, url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// TLDs — listar
app.get("/tlds", async (req, res) => {
  try {
    const tlds = await TLD.find({}, { tld: 1, _id: 0 })
    res.json(tlds.map(t => t.tld))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// TLDs — agregar (solo Luciano)
app.post("/tlds", auth, async (req, res) => {
  try {
    if (req.user.username !== "Luciano") return res.status(403).json({ error: "Unauthorized" })
    const { tld } = req.body
    if (!tld || !tld.startsWith(".")) return res.status(400).json({ error: "Invalid TLD" })
    await TLD.create({ tld: tld.toLowerCase() })
    res.json({ success: true, tld })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// TLDs — quitar (solo Luciano)
app.delete("/tlds/:tld", auth, async (req, res) => {
  try {
    if (req.user.username !== "Luciano") return res.status(403).json({ error: "Unauthorized" })
    await TLD.deleteOne({ tld: req.params.tld })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// =========================
// LUXER AI
// =========================

const LuxerUsageSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  tier: { type: String, enum: ["free", "pro", "max"], default: "free" },
  tierExpiresAt: { type: Date, default: null },
  messages: { type: Number, default: 0 },
  windowStart: { type: Date, default: Date.now },
  payg: { type: Boolean, default: false }
})
const LuxerUsage = mongoose.models.LuxerUsage || mongoose.model("LuxerUsage", LuxerUsageSchema)

const LUXER_TIERS = {
  free: { messages: 10, price: 0 },
  pro:  { messages: 50, price: 999 },
  max:  { messages: 250, price: 5549 }
}
const WINDOW_MS = 5 * 60 * 60 * 1000 // 5 horas

async function callGroq(messages) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: 1024 })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || "Groq error")
  return d.choices[0].message.content
}

async function callGemini(messages) {
  const contents = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }))
  const systemMsg = messages.find(m => m.role === "system")
  const body = { contents }
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || "Gemini error")
  return d.candidates[0].content.parts[0].text
}

async function callHuggingFace(messages) {
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join("\n") + "\nassistant:"
  const r = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.HF_API_KEY}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512 } })
  })
  const d = await r.json()
  if (!r.ok || d.error) throw new Error(d.error || "HF error")
  return Array.isArray(d) ? d[0].generated_text.split("assistant:").pop().trim() : d.generated_text
}

async function callOpenRouter(messages) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: "mistralai/mistral-7b-instruct:free", messages, max_tokens: 1024 })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || "OpenRouter error")
  return d.choices[0].message.content
}

async function callAI(messages) {
  const providers = [callGroq, callGemini, callHuggingFace, callOpenRouter]
  for (const fn of providers) {
    try { return { text: await fn(messages), ok: true } } catch (e) { continue }
  }
  return { text: null, ok: false }
}

// Chat
app.post("/luxer/chat", auth, async (req, res) => {
  try {
    const { messages } = req.body
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ error: "Missing messages" })

    let usage = await LuxerUsage.findOne({ username: req.user.username })
    if (!usage) usage = await LuxerUsage.create({ username: req.user.username })

    // Resetear ventana si pasaron 5 horas
    if (Date.now() - new Date(usage.windowStart).getTime() > WINDOW_MS) {
      usage.messages = 0
      usage.windowStart = new Date()
    }

    // Expirar tier si pasó 1 mes
    if (usage.tierExpiresAt && new Date() > usage.tierExpiresAt) {
      usage.tier = "free"
      usage.tierExpiresAt = null
    }

   const limit = LUXER_TIERS[usage.tier].messages
    if (usage.messages >= limit) {
      if (usage.payg) {
        const result = await callAI(messages)
        if (!result.ok) return res.status(503).json({ error: "All AI providers failed" })
        const cost = Math.ceil(result.text.length / 250)
        const user = await User.findById(req.user.id)
        if (user.lucks < cost) {
          return res.status(402).json({ error: "payg_insufficient", message: `Necesitas ${cost} LUCKS para esta respuesta pero solo tienes ${user.lucks}.` })
        }
        user.lucks -= cost
        await user.save()
        usage.messages += 1
        await usage.save()
        return res.json({ reply: result.text, usage: { messages: usage.messages, limit, tier: usage.tier }, payg: { charged: cost, balance: user.lucks } })
      }
      const next = { free: "pro", pro: "max" }[usage.tier]
      const price = next ? LUXER_TIERS[next].price : null
      const resetIn = Math.ceil((WINDOW_MS - (Date.now() - new Date(usage.windowStart).getTime())) / 60000)
      return res.status(429).json({
        error: "limit_reached",
        tier: usage.tier,
        next_tier: next || null,
        next_price: price,
        reset_in_minutes: resetIn,
        message: next
          ? `Alcanzaste tu límite de mensajes. Actualiza a ${next.charAt(0).toUpperCase() + next.slice(1)} por solo ${price} LUCKS al mes y obtén ${LUXER_TIERS[next].messages / LUXER_TIERS[usage.tier].messages}x más uso.`
          : `Alcanzaste el límite máximo. Reinicia en ${resetIn} minutos.`
      })
    }

    const trimmed = messages.map(m => ({
  ...m,
  content: m.content.length > 500 ? m.content.slice(0, 500) + "…[truncado]" : m.content
}))
const result = await callAI(trimmed)
    if (!result.ok) return res.status(503).json({ error: "All AI providers failed" })

    usage.messages += 1
    await usage.save()

    res.json({ reply: result.text, usage: { messages: usage.messages, limit, tier: usage.tier } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Suscribir
app.post("/luxer/subscribe", auth, async (req, res) => {
  try {
    const { tier } = req.body
    if (!["pro", "max"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" })

    const price = LUXER_TIERS[tier].price
    const user = await User.findById(req.user.id)
    if (user.lucks < price)
      return res.status(400).json({ error: "Not enough lucks" })

    user.lucks -= price
await user.save()
const luxerAccount = await User.findOneAndUpdate(
  { username: "Luxer" },
  { $inc: { lucks: price } }
)
if (!luxerAccount) console.warn("Cuenta @Luxer no existe")

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await LuxerUsage.findOneAndUpdate(
      { username: req.user.username },
      { tier, tierExpiresAt: expiresAt, messages: 0, windowStart: new Date() },
      { upsert: true, new: true }
    )

    res.json({ success: true, tier, expiresAt, lucks_remaining: user.lucks })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Estado del usuario
app.get("/luxer/status", auth, async (req, res) => {
  try {
    let usage = await LuxerUsage.findOne({ username: req.user.username })
    if (!usage) usage = await LuxerUsage.create({ username: req.user.username })
    if (usage.tierExpiresAt && new Date() > usage.tierExpiresAt) {
      usage.tier = "free"; usage.tierExpiresAt = null; await usage.save()
    }
    const resetIn = Math.ceil((WINDOW_MS - (Date.now() - new Date(usage.windowStart).getTime())) / 60000)
    res.json({
      tier: usage.tier,
      messages_used: usage.messages,
      messages_limit: LUXER_TIERS[usage.tier].messages,
      tier_expires_at: usage.tierExpiresAt,
      reset_in_minutes: resetIn < 0 ? 0 : resetIn,
      payg: usage.payg
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// =========================
// LUXER HISTORY
// =========================

const LuxerChatSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  username: String,
  title: String,
  messages: [{ role: String, content: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})
const LuxerChat = mongoose.models.LuxerChat || mongoose.model("LuxerChat", LuxerChatSchema)

// Listar chats
app.get("/luxer/chats", auth, async (req, res) => {
  try {
    const chats = await LuxerChat.find({ username: req.user.username }, { messages: 0 }).sort({ updatedAt: -1 })
    res.json(chats)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Obtener chat completo
app.get("/luxer/chats/:id", auth, async (req, res) => {
  try {
    const chat = await LuxerChat.findOne({ id: req.params.id, username: req.user.username })
    if (!chat) return res.status(404).json({ error: "Not found" })
    res.json(chat)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Crear chat
app.post("/luxer/chats", auth, async (req, res) => {
  try {
    const { title, messages } = req.body
    const chat = await LuxerChat.create({
      id: uuidv4(),
      username: req.user.username,
      title: title || "Nueva conversación",
      messages: messages || []
    })
    res.json(chat)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Actualizar chat (agregar mensajes, cambiar título)
app.put("/luxer/chats/:id", auth, async (req, res) => {
  try {
    const { messages, title } = req.body
    const chat = await LuxerChat.findOne({ id: req.params.id, username: req.user.username })
    if (!chat) return res.status(404).json({ error: "Not found" })
    if (messages !== undefined) chat.messages = messages
    if (title !== undefined) chat.title = title
    chat.updatedAt = new Date()
    await chat.save()
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Borrar chat
app.delete("/luxer/chats/:id", auth, async (req, res) => {
  try {
    const chat = await LuxerChat.findOne({ id: req.params.id, username: req.user.username })
    if (!chat) return res.status(404).json({ error: "Not found" })
    await chat.deleteOne()
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// LUXER INNERNET TOOLS
app.post("/luxer/innernet", auth, async (req, res) => {
  try {
    const { tool, params } = req.body
    if (tool === "check_domain") {
      const found = await Domain.findOne({ domain: params.domain })
      return res.json({ available: !found, owner: found?.owner || null })
    }
    if (tool === "get_balance") {
      const user = await User.findOne({ username: req.user.username })
      return res.json({ balance: user.lucks })
    }
    if (tool === "list_domains") {
      const domains = await Domain.find({ owner: req.user.username }, { domain: 1, cname: 1, _id: 0 })
      return res.json({ domains })
    }
    if (tool === "get_user_info") {
      const user = await User.findOne({ username: params.username }, { password: 0 })
      if (!user) return res.status(404).json({ error: "User not found" })
      return res.json({ username: user.username, lucks: user.lucks })
    }
    if (tool === "transfer_lucks") {
      const { to, amount } = params
      const sender = await User.findById(req.user.id)
      const receiver = await User.findOne({ username: to })
      if (!receiver) return res.status(404).json({ error: "User not found" })
      if (sender.lucks < amount) return res.status(400).json({ error: "Not enough lucks" })
      sender.lucks -= amount; receiver.lucks += amount
      await sender.save(); await receiver.save()
      return res.json({ success: true, balance: sender.lucks })
    }
    if (tool === "register_domain") {
      const { domain } = params
      const exists = await Domain.findOne({ domain })
      if (exists) return res.status(400).json({ error: "Domain taken" })
      const allowedDocs = await TLD.find()
      if (!allowedDocs.some(t => domain.endsWith(t.tld)))
        return res.status(400).json({ error: "Invalid TLD" })
      const user = await User.findById(req.user.id)
      if (user.lucks < DOMAIN_PRICE) return res.status(400).json({ error: "Not enough lucks" })
      user.lucks -= DOMAIN_PRICE; await user.save()
      const created = await Domain.create({ domain, owner: user.username })
      return res.json(created)
    }
    res.status(400).json({ error: "Unknown tool" })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/luxer/payg", auth, async (req, res) => {
  try {
    const { enabled } = req.body
    const usage = await LuxerUsage.findOneAndUpdate(
      { username: req.user.username },
      { payg: enabled },
      { upsert: true, new: true }
    )
    res.json({ payg: usage.payg })
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
