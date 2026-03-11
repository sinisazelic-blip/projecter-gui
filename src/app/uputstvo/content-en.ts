/**
 * User manual content (en).
 * Same structure as content-sr; IDs must match for i18n switching.
 */

import type { UputstvoSekcija } from "./content-sr";

export const uputstvoSekcijeEn: UputstvoSekcija[] = [
  {
    id: "uvod",
    title: "Introduction",
    content: `<p>Fluxa is an operating system that connects the entire workflow of an agency—from the first client contact to the final invoice and calculation of the actual project margin.</p>
<p>Fluxa helps agencies turn structured deals into controlled projects and profitable invoices, providing clear visibility of costs, team work, and final profit.</p>
<p><strong>The basic workflow in Fluxa is simple:</strong></p>
<p>Deal → Project → Invoice → Profit</p>
<p>The process works as follows:</p>
<ol>
<li>A deal is created and the project scope is defined.</li>
<li>After client approval, the deal becomes a project where the team tracks work stages and costs.</li>
<li>When the work is complete, an invoice is issued.</li>
<li>Fluxa automatically calculates the actual project margin.</li>
</ol>
<p>The system aims to give agencies a clear view of how profit is generated and where costs occur.</p>

<p><strong>1. What is Fluxa</strong></p>
<p>Fluxa is an operational control system designed for creative and marketing agencies.</p>
<p>The system connects the entire agency work lifecycle in a single clear flow:</p>
<p>Deal → Project → Invoice → Actual Profit</p>
<p>Fluxa enables owners and managers to:</p>
<ul>
<li>plan projects</li>
<li>track actual work costs</li>
<li>control budgets</li>
<li>analyze project profitability</li>
</ul>
<p>Instead of using multiple separate tools for sales, projects, and finance, Fluxa combines everything into a single operational system.</p>

<p><strong>2. Who Fluxa is For</strong></p>
<p>Fluxa is designed for small and medium agencies that manage multiple client projects simultaneously.</p>
<p>Typical users include:</p>
<ul>
<li>marketing agencies</li>
<li>creative studios</li>
<li>branding agencies</li>
<li>digital production agencies</li>
<li>design and communication studios</li>
</ul>
<p>It is especially useful for:</p>
<ul>
<li>agency owners</li>
<li>project managers</li>
<li>account managers</li>
</ul>
<p>Fluxa provides a clear overview of projects, costs, and profitability without the need for complex business software.</p>

<p><strong>3. How Fluxa Works</strong></p>
<p>Fluxa organizes work through three interconnected phases:</p>
<p><strong>1. Deals</strong><br>In this phase, a potential project is defined:</p>
<ul>
<li>client</li>
<li>scope of work</li>
<li>estimated budget</li>
</ul>
<p><strong>2. Project</strong><br>When the client approves the deal, it becomes a project. During the project, Fluxa tracks:</p>
<ul>
<li>work progress</li>
<li>project phases</li>
<li>internal costs</li>
</ul>
<p><strong>3. Invoice</strong><br>After the project is completed:</p>
<ul>
<li>an invoice is issued</li>
<li>the system calculates the actual project margin</li>
</ul>
<p>This workflow gives agency owners a complete picture of business operations.</p>

<p><strong>4. How to Register in Fluxa</strong></p>
<p>To use Fluxa, you need access from an administrator or to create a new workspace.</p>
<p>Steps to log in:</p>
<ol>
<li>Open the Fluxa login page</li>
<li>Enter your email and password</li>
<li>Select your organization (if you have multiple)</li>
<li>Click Login</li>
</ol>
<p>After logging in, the Dashboard opens—the system's central control panel.</p>

<p><strong>5. Language and Market Selection</strong></p>
<p>Fluxa supports multiple languages and regional configurations.</p>
<p>During first use, you can select:</p>
<p><strong>Language</strong> — the user interface language (e.g., English).</p>
<p><strong>Market / Region</strong> — regional settings that define:</p>
<ul>
<li>currency</li>
<li>tax rates</li>
<li>date format</li>
<li>financial rules</li>
</ul>
<p>These settings can later be changed in User Settings.</p>`,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: `<p><img src="/uputstvo/dashboard.png" alt="Dashboard" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>The Dashboard is Fluxa's central control panel.</p>
<p>From here, users can access all main system modules.</p>
<p>It is organized into several functional sections:</p>
<ul>
<li>operations</li>
<li>finance</li>
<li>analytics</li>
<li>system settings</li>
</ul>
<p>This structure allows quick navigation between daily operational tasks and administrative functions.</p>

<p><strong>Desk</strong></p>
<p>The Desk module is the starting point for operational work.</p>
<p>It contains three key elements:</p>
<p><strong>Deals</strong> — list of client negotiations.</p>
<p><strong>SC (Strategic Core)</strong> — quick calculator for project value estimation.</p>
<p><strong>PP (Project Overview)</strong> — list of all projects in the system.</p>
<p>Operational workflow: Deal → Project → Invoice → Profit</p>

<p><strong>Finance</strong></p>
<p>The Finance module contains tools for managing financial documents.</p>
<p>Here you can:</p>
<ul>
<li>manage invoices</li>
<li>keep financial records</li>
<li>track operational financial flows</li>
</ul>
<p>Some functions may depend on regional financial rules.</p>

<p><strong>Profit / Financial Analysis</strong></p>
<p>This module allows analysis of financial results.</p>
<p>Users can:</p>
<ul>
<li>analyze project profits</li>
<li>track margins</li>
<li>generate financial reports</li>
<li>analyze profit by client</li>
</ul>
<p>These tools help management understand how operational decisions affect financial results.</p>

<p><strong>Directories</strong></p>
<p>The Directories module contains operational data used throughout the system.</p>
<p>Here you manage:</p>
<ul>
<li>Clients</li>
<li>Talents / collaborators</li>
<li>Suppliers</li>
<li>Price lists</li>
<li>Work phases</li>
<li>Team members</li>
</ul>
<p>Proper maintenance ensures consistent structure of projects and offers.</p>

<p><strong>Company Settings</strong></p>
<p>This module allows administrators to configure organizational parameters.</p>
<p>It defines:</p>
<ul>
<li>company data</li>
<li>financial settings</li>
<li>user roles</li>
<li>system configurations</li>
</ul>
<p>These settings affect the entire system behavior.</p>`,
  },
  {
    id: "deals",
    title: "Deals (Negotiations)",
    content: `<p><img src="/uputstvo/deal.png" alt="Deal / Negotiation" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>The Deals module manages sales opportunities before a deal becomes a project.</p>
<p>Each deal represents a potential client project.</p>
<p>At this stage, you define:</p>
<ul>
<li>deal name</li>
<li>client</li>
<li>estimated budget</li>
<li>responsible person</li>
</ul>
<p>During negotiations, status can be changed to track progress.</p>
<p>Each deal has a timeline for:</p>
<ul>
<li>notes</li>
<li>offer changes</li>
<li>client communications</li>
</ul>
<p>When the client accepts the offer, the deal becomes a project.</p>

<p><strong>Deal Details</strong></p>
<p>The deal window is the central place to manage negotiations.</p>
<p>Here you define:</p>
<ul>
<li>project deadlines</li>
<li>budget</li>
<li>offer items</li>
<li>negotiation workflow</li>
</ul>

<p><strong>Deal Status and Phases</strong></p>
<p>At the top is a status bar showing the negotiation phase:</p>
<ul>
<li>Deal — initial phase</li>
<li>Production — project accepted</li>
<li>Completed — project finished</li>
<li>Closed — administratively closed</li>
<li>Invoiced — invoice issued</li>
<li>Archived — project archived</li>
</ul>
<p>Once closed, the deal becomes read-only.</p>

<p><strong>Timeline</strong></p>
<p>The timeline records key negotiation events:</p>
<ul>
<li>deal opening date</li>
<li>project deadline</li>
<li>deal confirmation method</li>
<li>notes</li>
</ul>

<p><strong>Items and Budget</strong></p>
<p>In the Items section, financial aspects are defined.</p>
<p>Users can:</p>
<ol>
<li>select an item from the price list</li>
<li>define quantity</li>
<li>enter price</li>
<li>add a description</li>
</ol>
<p>The system automatically calculates:</p>
<ul>
<li>item value</li>
<li>total project budget</li>
</ul>

<p><strong>Converting a Deal to a Project</strong></p>
<p>When the client confirms the deal:</p>
<ul>
<li>budget transfers to the project</li>
<li>project workflow starts</li>
<li>negotiation details are locked</li>
</ul>
<p>The deal then becomes the basis for operational project work.</p>`,
  },
  {
    id: "pp",
    title: "Project Overview (PP)",
    content: `<p>The Project Overview shows all projects in the system.</p>
<p>Here you can:</p>
<ul>
<li>view active projects</li>
<li>filter by status</li>
<li>review project archives</li>
<li>sort projects by criteria</li>
</ul>
<p>From this list, you can open project details and manage phases and finances.</p>`,
  },
  {
    id: "detalj-projekta",
    title: "Project Details",
    content: `<p><img src="/uputstvo/projekt.png" alt="Project details" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>The Project Details screen is the central operational console for managing a project. Its main purpose is to connect planned budgets with actual costs, allowing project managers to monitor profitability at all times.</p>
<p>Here you manage:</p>
<ul>
<li>project status</li>
<li>financial costs</li>
<li>work phases</li>
<li>project completion</li>
</ul>

<p><strong>Status and Workflow</strong></p>
<p>At the top is the workflow bar showing current project status.</p>
<p>Changing status signals the system which phase the project is in.</p>
<p>Example phases include:</p>
<ul>
<li>Production</li>
<li>Completed</li>
<li>Closed</li>
<li>Invoiced</li>
<li>Archived</li>
</ul>
<p>When the status is Invoiced, the system prepares for financial closure and billing.</p>

<p><strong>Tracking Financial Status</strong></p>
<p>Fluxa automatically tracks project financials in real time.</p>
<p>The system displays:</p>
<ul>
<li>planned budget</li>
<li>total costs</li>
<li>expected profit</li>
</ul>
<p>Project managers aim to keep costs below budget to ensure a positive project margin.</p>
<p>Visual indicators (colors and status) quickly show if the project exceeds financial limits.</p>

<p><strong>Operational Cost Entry</strong></p>
<p>The cost entry section records all expenses incurred during the project.</p>
<p>Each cost entry defines:</p>
<ul>
<li>type (e.g., fee, service, production)</li>
<li>person or collaborator responsible</li>
<li>amount</li>
<li>currency</li>
</ul>
<p>If marked as incurred, the cost is automatically deducted from the project budget.</p>
<p>If the cost is only planned, it serves as a budget reservation.</p>

<p><strong>Currency Conversion</strong></p>
<p>Fluxa supports multi-currency cost entry.</p>
<p>The Rate field automatically converts expenses to the system base currency.</p>
<p>The system uses the Central Bank rate at the time of entry for stable financial calculation.</p>

<p><strong>Documentation and Audit</strong></p>
<p>Each expense can include a note explaining context.</p>
<p>Notes help with:</p>
<ul>
<li>financial audits</li>
<li>project analysis</li>
<li>internal communication</li>
</ul>
<p>The cost table at the bottom shows a chronological record of entries.</p>

<p><strong>Project Phase Planning</strong></p>
<p>The PHASES button opens a Gantt chart displaying all project phases and deadlines.</p>
<p>This allows:</p>
<ul>
<li>planning phase order</li>
<li>defining micro-deadlines</li>
<li>controlling dependencies</li>
</ul>
<p>Fluxa prevents phase deadlines from exceeding the overall project deadline.</p>

<p><strong>Project Completion</strong></p>
<p>The FINAL OK button is used when all phases are complete.</p>
<p>At this point:</p>
<ul>
<li>the project is marked complete</li>
<li>it is returned to the Deal module</li>
<li>the account manager can confirm completion with the client</li>
</ul>
<p>When the client confirms, status changes to Closed.</p>
<p>From then on the project becomes read-only and moves to the financial module for invoicing.</p>`,
  },
  {
    id: "fakturisanje",
    title: "Invoicing and Invoices",
    content: `<p><img src="/uputstvo/faktura.png" alt="Invoice" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>Fluxa uses a three-step wizard to generate invoices.</p>
<p>This process converts completed projects into official financial documents.</p>

<p><strong>Step 1 — Project Selection</strong></p>
<p>In the first step, select projects to include in the invoice.</p>
<p>You can filter projects by:</p>
<ul>
<li>client</li>
<li>time period</li>
<li>project status</li>
</ul>
<p>Projects with status Closed are ready for invoicing.</p>
<p>When projects are selected, the system displays:</p>
<ul>
<li>base price</li>
<li>VAT amount</li>
<li>total amount</li>
</ul>

<p><strong>Step 2 — Invoice Settings</strong></p>
<p>In the second step, define the technical parameters of the invoice.</p>
<p>Enter:</p>
<ul>
<li>invoice date</li>
<li>currency</li>
<li>VAT regime</li>
<li>project or item name</li>
</ul>
<p>The system automatically generates a reference number, enabling later automatic matching of payments to the invoice.</p>
<p>You can change the project name if needed to match client terminology.</p>

<p><strong>Step 3 — Invoice Preview</strong></p>
<p>The third step shows a visual preview of the invoice before issuance.</p>
<p>On this screen you can check:</p>
<ul>
<li>issuer data</li>
<li>client data</li>
<li>invoice items</li>
<li>VAT amount</li>
<li>total amount due</li>
</ul>
<p>The system automatically adds bank payment instructions.</p>
<p>When the preview is complete, the invoice can be:</p>
<ul>
<li>downloaded as PDF</li>
<li>sent to the client</li>
</ul>`,
  },
  {
    id: "naplate",
    title: "Payments",
    content: `<p>Fluxa supports automatic payment recording via bank statements.</p>
<p>The bank statement must be in XML V2 format, which most banks support.</p>
<p>After importing the statement, the system automatically:</p>
<ul>
<li>recognizes the reference number</li>
<li>matches the payment to the invoice</li>
<li>marks the invoice as paid</li>
</ul>`,
  },
  {
    id: "finansije",
    title: "Finance",
    content: `<p>Fluxa includes a complete financial system for agency performance analysis.</p>
<p>The finance module allows:</p>
<ul>
<li>revenue analysis</li>
<li>cost analysis</li>
<li>project profitability overview</li>
<li>financial reporting</li>
</ul>
<p>The financial structure is based on international financial analysis standards.</p>`,
  },
  {
    id: "izvjestaji",
    title: "Reports",
    content: `<p>Fluxa enables generation of various business reports.</p>
<p>The system's main focus is tracking margin, which is a key performance indicator for agency business.</p>
<p>Reports allow analysis of:</p>
<ul>
<li>profit per project</li>
<li>profit per client</li>
<li>labor costs</li>
<li>overall agency performance</li>
</ul>`,
  },
  {
    id: "mobile",
    title: "Mobile",
    content: `<p>The Mobile module allows monitoring business on mobile devices.</p>
<p>It is aimed primarily at:</p>
<ul>
<li>agency owners</li>
<li>operations managers</li>
</ul>
<p>Via the mobile interface you can:</p>
<ul>
<li>track active project value</li>
<li>view completed projects</li>
<li>access the Deals list</li>
<li>view project details</li>
</ul>
<p>The mobile version displays simplified information optimized for mobile devices.</p>
<p>The Strategic Core (SC) calculator is integrated into this module for quick project value estimation during client negotiations.</p>`,
  },
  {
    id: "studio",
    title: "Company Settings",
    content: `<p>The Company Settings module is the central place for defining the company identity within the Fluxa system.</p>
<p>Data entered here is used when generating invoices and other documents.</p>

<p><strong>Basic Data</strong></p>
<p>In this section you enter:</p>
<ul>
<li>company name</li>
<li>short name</li>
<li>email</li>
<li>phone</li>
<li>website</li>
</ul>
<p>You can also upload a company logo to appear on invoices.</p>

<p><strong>Company Address</strong></p>
<p>Enter:</p>
<ul>
<li>address</li>
<li>city</li>
<li>postal code</li>
<li>country</li>
</ul>
<p>This data is automatically shown on all financial documents.</p>

<p><strong>Tax Data</strong></p>
<p>For legally valid invoices, enter:</p>
<ul>
<li>company identification number</li>
<li>VAT number</li>
<li>registration decision number</li>
</ul>

<p><strong>Bank Accounts</strong></p>
<p>Fluxa allows entering multiple bank accounts.</p>
<p>One account must be marked as the main account.</p>
<p>For international payments you can enter:</p>
<ul>
<li>IBAN</li>
<li>SWIFT code</li>
</ul>

<p><strong>User and Role Management</strong></p>
<p>Fluxa uses a role-based system for access control.</p>
<p>The administrator can define different access levels:</p>
<ul>
<li><strong>View</strong> — user can only view data</li>
<li><strong>Edit</strong> — user can add and change data</li>
<li><strong>Admin</strong> — full control over the system</li>
</ul>

<p><strong>Security and Accountability</strong></p>
<p>Each user has a personal login.</p>
<p>The system automatically logs:</p>
<ul>
<li>who entered a cost</li>
<li>who changed project status</li>
<li>who generated an invoice</li>
</ul>
<p>This ensures transparency and security of business data.</p>`,
  },
];
