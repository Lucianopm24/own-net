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

const PelicanUserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  displayName: String,
  pelicanId: { type: Number, unique: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
})

const PelicanFieldDefSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
})

const PelicanFieldValueSchema = new mongoose.Schema({
  fieldId: String,
  targetPelicanId: Number,
  value: String,
  updatedBy: String,
  updatedAt: { type: Date, default: Date.now }
})
PelicanFieldValueSchema.index({ fieldId: 1, targetPelicanId: 1 }, { unique: true })

const PelicanPermissionSchema = new mongoose.Schema({
  username: { type: String, unique: true }
})

const ElectionSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  title: String,
  status: { type: String, enum: ["open", "closed"], default: "closed" },
  showResults: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

const CategorySchema = new mongoose.Schema({
  id: { type: String, unique: true },
  electionId: String,
  title: String,
  candidates: [{ id: String, name: String, registradoriaId: { type: String, default: null } }]
})

const VoteSchema = new mongoose.Schema({
  electionId: String,
  categoryId: String,
  candidateId: String,
  voterHash: String, // hash del username, nunca el username directo
  createdAt: { type: Date, default: Date.now }
})
VoteSchema.index({ categoryId: 1, voterHash: 1 }, { unique: true })

const CandidateApplicationSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  username: String,
  displayName: String,
  pdfUrl: String,
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
})

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
    email: { type: String, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    twoFactorSecret: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    referredBy: { type: String, default: null },
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
const PelicanUser = mongoose.models.PelicanUser || mongoose.model("PelicanUser", PelicanUserSchema)
const Election = mongoose.models.Election || mongoose.model("Election", ElectionSchema)
const Category = mongoose.models.Category || mongoose.model("Category", CategorySchema)
const Vote = mongoose.models.Vote || mongoose.model("Vote", VoteSchema)
const CandidateApplication = mongoose.models.CandidateApplication || mongoose.model("CandidateApplication", CandidateApplicationSchema)
const PelicanFieldDef = mongoose.models.PelicanFieldDef || mongoose.model("PelicanFieldDef", PelicanFieldDefSchema)
const PelicanFieldValue = mongoose.models.PelicanFieldValue || mongoose.model("PelicanFieldValue", PelicanFieldValueSchema)
const PelicanPermission = mongoose.models.PelicanPermission || mongoose.model("PelicanPermission", PelicanPermissionSchema)

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

// Procesar referido
const { ref } = req.body
if (ref && ref !== username) {
  const referrer = await User.findOne({ username: ref })
  if (referrer) {
    referrer.lucks += 25
    await referrer.save()
    user.referredBy = ref
    await user.save()
  }
}
            
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

           if (user.twoFactorEnabled) {
  const tempToken = jwt.sign(
    { id: user._id, username: user.username, temp: true },
    JWT_SECRET,
    { expiresIn: "5m" }
  )
  return res.json({ requiresTwoFactor: true, tempToken })
}
const token = createToken(user)
res.json({
    token,
    username: user.username,
    lucks: user.lucks
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
  username: user.username,
  lucks: user.lucks,
  twoFactorEnabled: user.twoFactorEnabled || false
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

if (!/^[a-z0-9-]+\.[a-z]+$/.test(domain))
  return res.status(400).json({ error: "Invalid domain format" })
            
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

// 10% al referidor
if (user.referredBy) {
  const referrer = await User.findOne({ username: user.referredBy })
  if (referrer) {
    const commission = Math.floor(DOMAIN_PRICE * 0.1)
    referrer.lucks += commission
    await referrer.save()
  }
}
            
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
app.get("/resolve/sub/:full", async (req, res) => {
  try {
    const parts = req.params.full.split(".")
    const subdomain = parts[0]
    const domain = parts.slice(1).join(".")
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
  free: { messages: 25, price: 0 },
  pro:  { messages: 125, price: 399 },
  max:  { messages: 625, price: 1549 }
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

async function callMistral(messages) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({ model: "mistral-small-latest", messages, max_tokens: 1024 })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || "Mistral error")
  return d.choices[0].message.content
}

async function callCohere(messages) {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "CHATBOT" : "USER",
    message: m.content
  }))
  const last = messages[messages.length - 1]
  const r = await fetch("https://api.cohere.com/v1/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.COHERE_API_KEY}`
    },
    body: JSON.stringify({ model: "command-r", message: last.content, chat_history: history, max_tokens: 1024 })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || "Cohere error")
  return d.text
}

async function callCloudflareAI(messages) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CF_AI_TOKEN}`
      },
      body: JSON.stringify({ messages, max_tokens: 1024 })
    }
  )
  const d = await r.json()
  if (!r.ok || !d.success) throw new Error("Cloudflare AI error")
  return d.result.response
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
  const providers = [
    callGroq,
    callGemini,
    callMistral,
    callCohere,
    callHuggingFace,
    callOpenRouter,
    callCloudflareAI
  ]
  for (const fn of providers) {
    try { return { text: await fn(messages), ok: true } } catch { continue }
  }
  return { text: null, ok: false }
}
// Chat
app.post("/luxer/chat", auth, async (req, res) => {
  try {
    const { messages, model: selectedModel } = req.body
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
          return res.status(402).json({ error: "payg_insufficient", message: `Necesitas ${cost} LUCKS pero solo tienes ${user.lucks}.` })
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

    const { model } = req.body

const MODEL_PROVIDERS = {
  auto:        { fn: callAI,          tiers: ["free","pro","max"], cost: 1 },
  groq:        { fn: callGroq,        tiers: ["pro","max"],        cost: 3 },
  mistral:     { fn: callMistral,     tiers: ["pro","max"],        cost: 3 },
  cohere:      { fn: callCohere,      tiers: ["pro","max"],        cost: 3 },
  gemini:      { fn: callGemini,      tiers: ["max"],              cost: 3 },
  cloudflare:  { fn: callCloudflareAI,tiers: ["max"],              cost: 3 },
  huggingface: { fn: callHuggingFace, tiers: ["free","pro","max"], cost: 2 },
  openrouter:  { fn: callOpenRouter,  tiers: ["free","pro","max"], cost: 2 },
}

const selected = MODEL_PROVIDERS[selectedModel] || MODEL_PROVIDERS.auto
if (!selected.tiers.includes(usage.tier))
  return res.status(403).json({ error: "model_locked", message: `Ese modelo requiere un plan superior.` })

const msgCost = selected.cost
if (usage.messages + msgCost > limit && !usage.payg)
  return res.status(429).json({ error: "limit_reached", tier: usage.tier })

const trimmed = messages.map(m => ({
  ...m,
  content: m.content.length > 500 ? m.content.slice(0, 500) + "…[truncado]" : m.content
}))

let result
if (selectedModel && selectedModel !== "auto") {
  try {
    const text = await selected.fn(trimmed)
    result = { text, ok: true }
  } catch {
    result = await callAI(trimmed)
  }
} else {
  result = await callAI(trimmed)
}
    if (!result.ok) return res.status(503).json({ error: "All AI providers failed" })

    usage.messages += msgCost
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

const speakeasy = require("speakeasy")
const QRCode = require("qrcode")
const nodemailer = require("nodemailer")

// Transporter SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// ═══════════════════════
// EMAIL
// ═══════════════════════

// Agregar/actualizar email
app.post("/auth/email", auth, async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !email.includes("@"))
      return res.status(400).json({ error: "Invalid email" })
    const taken = await User.findOne({ email, _id: { $ne: req.user.id } })
    if (taken)
      return res.status(400).json({ error: "Email already in use" })
    await User.findByIdAndUpdate(req.user.id, { email })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// FORGOT PASSWORD
// ═══════════════════════

app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: "Missing email" })

    const user = await User.findOne({ email })
    // Siempre responde igual para no revelar si existe
    if (!user) return res.json({ success: true })

    const token = require("crypto").randomBytes(32).toString("hex")
    user.resetToken = token
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hora
    await user.save()

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

    await transporter.sendMail({
      from: `"InnerNet" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Reset your InnerNet password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password. It expires in 1 hour.</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you didn't request this, ignore this email.</p>
      `
    })

    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword)
      return res.status(400).json({ error: "Missing fields" })

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    })
    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" })

    user.password = await bcrypt.hash(newPassword, 10)
    user.resetToken = null
    user.resetTokenExpiry = null
    await user.save()

    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// 2FA
// ═══════════════════════

// Generar secret y QR
app.post("/auth/2fa/setup", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (user.twoFactorEnabled)
      return res.status(400).json({ error: "2FA already enabled" })

    const secret = speakeasy.generateSecret({
      name: `InnerNet (${user.username})`
    })

    // Guardamos el secret temporal (sin activar aún)
    user.twoFactorSecret = secret.base32
    await user.save()

    const qrUrl = await QRCode.toDataURL(secret.otpauth_url)
    res.json({ secret: secret.base32, qr: qrUrl })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Verificar código y activar
app.post("/auth/2fa/verify", auth, async (req, res) => {
  try {
    const { code } = req.body
    const user = await User.findById(req.user.id)

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1
    })

    if (!valid)
      return res.status(400).json({ error: "Invalid code" })

    user.twoFactorEnabled = true
    await user.save()

    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Confirmar 2FA en login (token provisional → token real)
app.post("/auth/2fa/confirm", async (req, res) => {
  try {
    const { tempToken, code } = req.body
    if (!tempToken || !code)
      return res.status(400).json({ error: "Missing fields" })

    let decoded
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET)
    } catch {
      return res.status(401).json({ error: "Invalid temp token" })
    }

    if (!decoded.temp)
      return res.status(400).json({ error: "Not a temp token" })

    const user = await User.findById(decoded.id)
    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1
    })

    if (!valid)
      return res.status(400).json({ error: "Invalid code" })

    const token = createToken(user)
    res.json({ token, username: user.username, lucks: user.lucks })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Desactivar 2FA
app.post("/auth/2fa/disable", auth, async (req, res) => {
  try {
    const { code } = req.body
    const user = await User.findById(req.user.id)

    if (!user.twoFactorEnabled)
      return res.status(400).json({ error: "2FA not enabled" })

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1
    })

    if (!valid)
      return res.status(400).json({ error: "Invalid code" })

    user.twoFactorEnabled = false
    user.twoFactorSecret = null
    await user.save()

    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

const crypto = require("crypto")
function hashVoter(username) {
  return crypto.createHash("sha256").update(username + process.env.JWT_SECRET).digest("hex")
}

// Middleware admin Pelican (Innernet Luciano)
function pelicanAdmin(req, res, next) {
  if (req.user?.username !== "Luciano")
    return res.status(403).json({ error: "Unauthorized" })
  next()
}

// Auth Pelican
async function pelicanAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ error: "No token" })
    const token = header.split(" ")[1]
    const decoded = jwt.verify(token, JWT_SECRET + "_pelican")
    req.pelican = decoded
    next()
  } catch { res.status(401).json({ error: "Invalid token" }) }
}

// ═══════════════════════
// PELICAN AUTH
// ═══════════════════════

// Solicitar cuenta (registro)
app.post("/pelican/request", async (req, res) => {
  try {
    const { username, password, displayName } = req.body
    if (!username || !password || !displayName)
      return res.status(400).json({ error: "Missing fields" })
    const exists = await PelicanUser.findOne({ username })
    if (exists) return res.status(400).json({ error: "Username taken" })
    const hashed = await bcrypt.hash(password, 10)
      // En /pelican/request, antes del create:
const last = await PelicanUser.findOne().sort({ pelicanId: -1 })
const pelicanId = (last?.pelicanId || 0) + 1
await PelicanUser.create({ username, password: hashed, displayName, pelicanId })
    await PelicanUser.create({ username, password: hashed, displayName })
    res.json({ success: true, message: "Request sent, wait for approval" })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Login Pelican
app.post("/pelican/login", async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await PelicanUser.findOne({ username })
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.status === "pending") return res.status(403).json({ error: "Account pending approval" })
    if (user.status === "rejected") return res.status(403).json({ error: "Account rejected" })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: "Invalid password" })
    const token = jwt.sign({ username: user.username, displayName: user.displayName }, JWT_SECRET + "_pelican", { expiresIn: "30d" })
    res.json({ token, username: user.username, displayName: user.displayName })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get("/pelican/me", pelicanAuth, async (req, res) => {
  try {
    const user = await PelicanUser.findOne({ username: req.pelican.username }, { password: 0 })
    if (!user) return res.status(404).json({ error: "Not found" })
    res.json({ username: user.username, displayName: user.displayName })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// ADMIN — USUARIOS
// ═══════════════════════

// Listar solicitudes pendientes
app.get("/pelican/admin/requests", auth, pelicanAdmin, async (req, res) => {
  try {
    const users = await PelicanUser.find({ status: "pending" }, { password: 0 })
    res.json(users)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Aprobar o rechazar
app.post("/pelican/admin/requests/:username", auth, pelicanAdmin, async (req, res) => {
  try {
    const { action } = req.body // "approve" | "reject"
    if (!["approve", "reject"].includes(action))
      return res.status(400).json({ error: "Invalid action" })
    const user = await PelicanUser.findOne({ username: req.params.username })
    if (!user) return res.status(404).json({ error: "User not found" })
    user.status = action === "approve" ? "approved" : "rejected"
    await user.save()
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// ADMIN — ELECCIONES
// ═══════════════════════

// Crear elección
app.post("/pelican/admin/elections", auth, pelicanAdmin, async (req, res) => {
  try {
    const { title } = req.body
    const election = await Election.create({ id: uuidv4(), title })
    res.json(election)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Listar elecciones
app.get("/pelican/elections", async (req, res) => {
  try {
    const elections = await Election.find().sort({ createdAt: -1 })
    res.json(elections)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Abrir/cerrar elección y mostrar resultados
app.post("/pelican/admin/elections/:id", auth, pelicanAdmin, async (req, res) => {
  try {
    const { status, showResults } = req.body
    const election = await Election.findOne({ id: req.params.id })
    if (!election) return res.status(404).json({ error: "Not found" })
    if (status !== undefined) election.status = status
    if (showResults !== undefined) election.showResults = showResults
    await election.save()
    res.json(election)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Editar título
app.put("/pelican/admin/elections/:id", auth, pelicanAdmin, async (req, res) => {
  try {
    const { title } = req.body
    const election = await Election.findOne({ id: req.params.id })
    if (!election) return res.status(404).json({ error: "Not found" })
    election.title = title
    await election.save()
    res.json(election)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// ADMIN — CATEGORÍAS
// ═══════════════════════

// Crear categoría
app.post("/pelican/admin/elections/:id/categories", auth, pelicanAdmin, async (req, res) => {
  try {
    const { title } = req.body
    const category = await Category.create({ id: uuidv4(), electionId: req.params.id, title, candidates: [] })
    res.json(category)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Listar categorías de una elección
app.get("/pelican/elections/:id/categories", async (req, res) => {
  try {
    const categories = await Category.find({ electionId: req.params.id })
    res.json(categories)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Agregar candidato a categoría
app.post("/pelican/admin/categories/:id/candidates", auth, pelicanAdmin, async (req, res) => {
  try {
    const { name, registradoriaId } = req.body
    const category = await Category.findOne({ id: req.params.id })
    if (!category) return res.status(404).json({ error: "Not found" })
    category.candidates.push({ id: uuidv4(), name, registradoriaId: registradoriaId || null })
    await category.save()
    res.json(category)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Editar/eliminar candidato
app.delete("/pelican/admin/categories/:id/candidates/:candidateId", auth, pelicanAdmin, async (req, res) => {
  try {
    const category = await Category.findOne({ id: req.params.id })
    if (!category) return res.status(404).json({ error: "Not found" })
    category.candidates = category.candidates.filter(c => c.id !== req.params.candidateId)
    await category.save()
    res.json(category)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// VOTAR
// ═══════════════════════

app.post("/pelican/vote", pelicanAuth, async (req, res) => {
  try {
    const { electionId, categoryId, candidateId } = req.body
    const election = await Election.findOne({ id: electionId })
    if (!election) return res.status(404).json({ error: "Election not found" })
    if (election.status !== "open") return res.status(400).json({ error: "Election is closed" })

    const category = await Category.findOne({ id: categoryId })
    if (!category) return res.status(404).json({ error: "Category not found" })

    // Validar candidato (incluyendo voto en blanco)
    const validCandidate = candidateId === "blank" || category.candidates.some(c => c.id === candidateId)
    if (!validCandidate) return res.status(400).json({ error: "Invalid candidate" })

    const voterHash = hashVoter(req.pelican.username)

    await Vote.create({ electionId, categoryId, candidateId, voterHash })
    res.json({ success: true })
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: "Already voted in this category" })
    res.status(500).json({ error: e.message })
  }
})

// Ver si ya votó en cada categoría
app.get("/pelican/myvotes/:electionId", pelicanAuth, async (req, res) => {
  try {
    const voterHash = hashVoter(req.pelican.username)
    const votes = await Vote.find({ electionId: req.params.electionId, voterHash }, { categoryId: 1, _id: 0 })
    res.json(votes.map(v => v.categoryId))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// RESULTADOS
// ═══════════════════════

app.get("/pelican/elections/:id/results", async (req, res) => {
  try {
    const election = await Election.findOne({ id: req.params.id })
    if (!election) return res.status(404).json({ error: "Not found" })

    if (!election.showResults) {
      let isAdmin = false
      const authHeader = req.headers.authorization
      if (authHeader) {
        try {
          const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET)
          if (decoded.username === "Luciano") isAdmin = true
        } catch {}
      }
      if (!isAdmin) return res.status(403).json({ error: "Results not available yet" })
    }

    const categories = await Category.find({ electionId: req.params.id })
    const results = await Promise.all(categories.map(async cat => {
      const votes = await Vote.find({ categoryId: cat.id })
      const counts = {}
      votes.forEach(v => { counts[v.candidateId] = (counts[v.candidateId] || 0) + 1 })
      return {
        categoryId: cat.id,
        title: cat.title,
        total: votes.length,
        counts
      }
    }))
    res.json(results)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// REGISTRADURIA
// ═══════════════════════

// Postularse como candidato
app.post("/pelican/registraduria/apply", pelicanAuth, async (req, res) => {
  try {
    const { displayName, pdfUrl } = req.body
    if (!displayName || !pdfUrl) return res.status(400).json({ error: "Missing fields" })
    const exists = await CandidateApplication.findOne({ username: req.pelican.username })
    if (exists) return res.status(400).json({ error: "Already applied" })
    const app2 = await CandidateApplication.create({
      id: uuidv4(), username: req.pelican.username, displayName, pdfUrl
    })
    res.json(app2)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Listar aplicaciones (admin)
app.get("/pelican/admin/registraduria", auth, pelicanAdmin, async (req, res) => {
  try {
    const apps = await CandidateApplication.find().sort({ createdAt: -1 })
    res.json(apps)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Aprobar/rechazar candidato
app.post("/pelican/admin/registraduria/:id", auth, pelicanAdmin, async (req, res) => {
  try {
    const { action } = req.body
    const app2 = await CandidateApplication.findOne({ id: req.params.id })
    if (!app2) return res.status(404).json({ error: "Not found" })
    app2.status = action === "approve" ? "approved" : "rejected"
    await app2.save()
    res.json(app2)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Ver candidatos aprobados (público)
app.get("/pelican/registraduria", async (req, res) => {
  try {
    const candidates = await CandidateApplication.find({ status: "approved" }, { username: 0 })
    res.json(candidates)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Middleware permiso (admin o usuario con permiso)
async function pelicanPermission(req, res, next) {
  if (req.user?.username === "Luciano") { next(); return }
  const hasPerm = await PelicanPermission.findOne({ username: req.pelican?.username })
  if (!hasPerm) return res.status(403).json({ error: "No permission" })
  next()
}

// Ver perfil por ID (público)
app.get("/pelican/id/:id", async (req, res) => {
  try {
    const user = await PelicanUser.findOne({ pelicanId: req.params.id }, { password: 0 })
    if (!user) return res.status(404).json({ error: "Not found" })
    const fields = await PelicanFieldDef.find()
    const values = await PelicanFieldValue.find({ targetPelicanId: Number(req.params.id) })
    res.json({ user, fields, values })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// CAMPOS
// ═══════════════════════

// Listar campos definidos
app.get("/pelican/fields", async (req, res) => {
  try {
    const fields = await PelicanFieldDef.find()
    res.json(fields)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Crear campo (admin o con permiso)
app.post("/pelican/fields", async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: "No token" })
    const token = authHeader.split(" ")[1]
    let createdBy
    try {
      const d = jwt.verify(token, JWT_SECRET)
      if (d.username !== "Luciano") return res.status(403).json({ error: "Unauthorized" })
      createdBy = d.username
    } catch {
      const d = jwt.verify(token, JWT_SECRET + "_pelican")
      const perm = await PelicanPermission.findOne({ username: d.username })
      if (!perm) return res.status(403).json({ error: "No permission" })
      createdBy = d.username
    }
    const { name } = req.body
    const field = await PelicanFieldDef.create({ id: uuidv4(), name, createdBy })
    res.json(field)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Eliminar campo (solo admin)
app.delete("/pelican/fields/:id", auth, pelicanAdmin, async (req, res) => {
  try {
    await PelicanFieldDef.deleteOne({ id: req.params.id })
    await PelicanFieldValue.deleteMany({ fieldId: req.params.id })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Editar valor de campo en un perfil
app.post("/pelican/fields/:fieldId/value/:pelicanId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: "No token" })
    const token = authHeader.split(" ")[1]
    let updatedBy
    try {
      const d = jwt.verify(token, JWT_SECRET)
      if (d.username !== "Luciano") return res.status(403).json({ error: "Unauthorized" })
      updatedBy = d.username
    } catch {
      const d = jwt.verify(token, JWT_SECRET + "_pelican")
      const perm = await PelicanPermission.findOne({ username: d.username })
      if (!perm) return res.status(403).json({ error: "No permission" })
      updatedBy = d.username
    }
    const { value } = req.body
    await PelicanFieldValue.findOneAndUpdate(
      { fieldId: req.params.fieldId, targetPelicanId: Number(req.params.pelicanId) },
      { value, updatedBy, updatedAt: new Date() },
      { upsert: true, new: true }
    )
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Eliminar valor de campo
app.delete("/pelican/fields/:fieldId/value/:pelicanId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: "No token" })
    const token = authHeader.split(" ")[1]
    try {
      const d = jwt.verify(token, JWT_SECRET)
      if (d.username !== "Luciano") return res.status(403).json({ error: "Unauthorized" })
    } catch {
      const d = jwt.verify(token, JWT_SECRET + "_pelican")
      const perm = await PelicanPermission.findOne({ username: d.username })
      if (!perm) return res.status(403).json({ error: "No permission" })
    }
    await PelicanFieldValue.deleteOne({ fieldId: req.params.fieldId, targetPelicanId: Number(req.params.pelicanId) })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ═══════════════════════
// PERMISOS
// ═══════════════════════

// Listar usuarios con permiso
app.get("/pelican/admin/permissions", auth, pelicanAdmin, async (req, res) => {
  try {
    const perms = await PelicanPermission.find()
    res.json(perms)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Dar permiso
app.post("/pelican/admin/permissions/:username", auth, pelicanAdmin, async (req, res) => {
  try {
    await PelicanPermission.findOneAndUpdate(
      { username: req.params.username },
      { username: req.params.username },
      { upsert: true }
    )
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Quitar permiso
app.delete("/pelican/admin/permissions/:username", auth, pelicanAdmin, async (req, res) => {
  try {
    await PelicanPermission.deleteOne({ username: req.params.username })
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// TELEGRAM PDF UPLOAD
app.post("/telegram/upload-pdf", async (req, res) => {
  try {
    const { base64, filename } = req.body
    if (!base64) return res.status(400).json({ error: "Missing file" })

    const token = process.env.TG_BOT_TOKEN
    const chatId = process.env.TG_CHAT_ID

    const buffer = Buffer.from(base64, "base64")
    if (buffer.length > 20 * 1024 * 1024)
      return res.status(400).json({ error: "File too large (max 20MB)" })

    const FormData = require("form-data")
    const form = new FormData()
    form.append("chat_id", chatId)
    form.append("document", buffer, {
      filename: filename || "documento.pdf",
      contentType: "application/pdf"
    })

    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST", body: form, headers: form.getHeaders()
    })
    const d = await r.json()
    if (!d.ok) return res.status(500).json({ error: d.description })

    const fileId = d.result.document.file_id

    // Devuelve el fileId — permanente mientras exista el bot
    res.json({ success: true, fileId, url: `/telegram/file/${fileId}` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Regenerar URL fresca a partir del fileId
app.get("/telegram/file/:fileId", async (req, res) => {
  try {
    const token = process.env.TG_BOT_TOKEN
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${req.params.fileId}`)
    const d = await r.json()
    if (!d.ok) return res.status(404).json({ error: "File not found" })
    const url = `https://api.telegram.org/file/bot${token}/${d.result.file_path}`
    // Redirect directo al archivo
    res.redirect(url)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/telegram/preview/:fileId", async (req, res) => {
  try {
    const token = process.env.TG_BOT_TOKEN
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${req.params.fileId}`)
    const d = await r.json()
    if (!d.ok) return res.status(404).send("File not found")
    const url = `https://api.telegram.org/file/bot${token}/${d.result.file_path}`
    // Sirve el PDF con header inline para que el navegador lo muestre
    const pdfRes = await fetch(url)
    const buffer = await pdfRes.buffer()
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", "inline")
    res.send(buffer)
  } catch (e) {
    res.status(500).send(e.message)
  }
})

// =========================
// CDN
// =========================

const CDNFileSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  fileId: String,
  filename: String,
  mimetype: String,
  size: Number,
  owner: String,
  public: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})
const CDNFile = mongoose.models.CDNFile || mongoose.model("CDNFile", CDNFileSchema)

function cdnPrice(sizeBytes) {
  const mb = sizeBytes / (1024 * 1024)
  if (mb < 4.5) return 10
  if (mb < 20)  return 30
  if (mb < 50)  return 60
  if (mb < 100) return 100
  return 200
}

// Subir archivo
app.post("/cdn/upload", auth, async (req, res) => {
  try {
    const { base64, filename, mimetype, public: isPublic } = req.body
    if (!base64 || !filename) return res.status(400).json({ error: "Missing fields" })

    const buffer = Buffer.from(base64, "base64")
    const size = buffer.length
    const price = cdnPrice(size)

    const user = await User.findById(req.user.id)
    if (user.lucks < price)
      return res.status(400).json({ error: `Not enough lucks. Need ${price} LUCKS for this file.` })

    const token = process.env.TG_BOT_TOKEN
    const chatId = process.env.TG_CHAT_ID
    const FormData = require("form-data")
    const form = new FormData()
    form.append("chat_id", chatId)
    form.append("document", buffer, { filename, contentType: mimetype || "application/octet-stream" })

    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST", body: form, headers: form.getHeaders()
    })
    const d = await r.json()
    if (!d.ok) return res.status(500).json({ error: d.description })

    const fileId = d.result.document.file_id

    user.lucks -= price
    await user.save()

    const file = await CDNFile.create({
      id: uuidv4(), fileId, filename,
      mimetype: mimetype || "application/octet-stream",
      size, owner: user.username,
      public: isPublic || false
    })

    res.json({ success: true, id: file.id, price, balance: user.lucks })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Listar archivos del usuario
app.get("/cdn/files", auth, async (req, res) => {
  try {
    const files = await CDNFile.find({ owner: req.user.username }).sort({ createdAt: -1 })
    res.json(files)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Servir archivo
app.get("/cdn/file/:id", async (req, res) => {
  try {
    const file = await CDNFile.findOne({ id: req.params.id })
    if (!file) return res.status(404).json({ error: "Not found" })
    if (!file.public) {
      const auth2 = req.headers.authorization
      if (!auth2) return res.status(403).json({ error: "Private file" })
      try {
        const decoded = jwt.verify(auth2.split(" ")[1], JWT_SECRET)
        if (decoded.username !== file.owner) return res.status(403).json({ error: "Unauthorized" })
      } catch { return res.status(403).json({ error: "Unauthorized" }) }
    }
    const token = process.env.TG_BOT_TOKEN
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file.fileId}`)
    const d = await r.json()
    if (!d.ok) return res.status(404).json({ error: "File not found on Telegram" })
    const url = `https://api.telegram.org/file/bot${token}/${d.result.file_path}`
    const fileRes = await fetch(url)
    const buffer = await fileRes.buffer()
    res.setHeader("Content-Type", file.mimetype)
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`)
    res.send(buffer)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Eliminar archivo
app.delete("/cdn/file/:id", auth, async (req, res) => {
  try {
    const file = await CDNFile.findOne({ id: req.params.id })
    if (!file) return res.status(404).json({ error: "Not found" })
    if (file.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    await file.deleteOne()
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Cambiar visibilidad
app.post("/cdn/file/:id/visibility", auth, async (req, res) => {
  try {
    const { public: isPublic } = req.body
    const file = await CDNFile.findOne({ id: req.params.id })
    if (!file) return res.status(404).json({ error: "Not found" })
    if (file.owner !== req.user.username) return res.status(403).json({ error: "Unauthorized" })
    file.public = isPublic
    await file.save()
    res.json({ success: true, public: file.public })
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
