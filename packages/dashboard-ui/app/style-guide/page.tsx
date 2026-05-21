"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

const TABLE_ROWS = [
  { id: "sess_01", phone: "+447700900000", status: "open", since: "2 min ago" },
  { id: "sess_02", phone: "+923001234567", status: "connecting", since: "5 min ago" },
  { id: "sess_03", phone: "+1234567890", status: "closed", since: "1 hr ago" },
  { id: "sess_04", phone: "+49123456789", status: "open", since: "3 hr ago" },
  { id: "sess_05", phone: "+33123456789", status: "connecting", since: "12 hr ago" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  connecting: "secondary",
  closed: "outline",
};

export default function StyleGuidePage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 flex flex-col gap-12">
      <div>
        <h1 className="text-3xl font-bold">Style Guide</h1>
        <p className="text-muted-foreground mt-1">Internal QA reference — not linked in nav.</p>
      </div>

      {/* COLOURS */}
      <Section title="Colours">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {[
            { name: "background", cls: "bg-background border" },
            { name: "foreground", cls: "bg-foreground" },
            { name: "primary", cls: "bg-primary" },
            { name: "muted", cls: "bg-muted" },
            { name: "accent", cls: "bg-accent" },
            { name: "border", cls: "bg-border" },
            { name: "destructive", cls: "bg-destructive" },
            { name: "secondary", cls: "bg-secondary" },
            { name: "card", cls: "bg-card border" },
          ].map(({ name, cls }) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-12 rounded-md ${cls}`} />
              <span className="text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* TYPOGRAPHY */}
      <Section title="Typography">
        <h1 className="text-4xl font-bold">Heading 1</h1>
        <h2 className="text-3xl font-semibold">Heading 2</h2>
        <h3 className="text-2xl font-semibold">Heading 3</h3>
        <h4 className="text-xl font-medium">Heading 4</h4>
        <p className="text-base">Body text — regular paragraph content at base size.</p>
        <p className="text-muted-foreground">Muted text — secondary copy, descriptions, helpers.</p>
        <p className="text-sm">Small text — labels, captions, metadata.</p>
        <p className="font-mono text-sm">Monospace — code, IDs, tokens.</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Overline / micro label</p>
      </Section>

      {/* BADGES */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white">GET</Badge>
          <Badge className="bg-green-600 hover:bg-green-700 text-white">POST</Badge>
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white">PUT</Badge>
          <Badge className="bg-red-500 hover:bg-red-600 text-white">DELETE</Badge>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /><Badge variant="default">open</Badge></span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500" /><Badge variant="secondary">connecting</Badge></span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" /><Badge variant="outline">closed</Badge></span>
        </div>
      </Section>

      {/* BUTTONS */}
      <Section title="Buttons">
        {(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-xs text-muted-foreground">{variant}</span>
            <Button size="sm" variant={variant}>Small</Button>
            <Button variant={variant}>Default</Button>
            <Button size="lg" variant={variant}>Large</Button>
          </div>
        ))}
      </Section>

      {/* FORM ELEMENTS */}
      <Section title="Form Elements">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text-input">Text input</Label>
            <Input id="text-input" placeholder="Placeholder text" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pass-input">Password input</Label>
            <Input id="pass-input" type="password" placeholder="••••••••" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="textarea">Textarea</Label>
            <Textarea id="textarea" placeholder="Enter your message…" rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Select</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Choose option" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Option A</SelectItem>
                <SelectItem value="b">Option B</SelectItem>
                <SelectItem value="c">Option C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="chk" />
              <Label htmlFor="chk">Checkbox</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sw" />
              <Label htmlFor="sw">Switch</Label>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Radio group</Label>
            <RadioGroup defaultValue="a" className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="a" id="r1" /><Label htmlFor="r1">Option A</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="b" id="r2" /><Label htmlFor="r2">Option B</Label></div>
            </RadioGroup>
          </div>
        </div>
      </Section>

      {/* CARDS */}
      <Section title="Cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">Basic card content.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description goes here.</CardDescription>
            </CardHeader>
            <CardContent>Content area.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>With footer</CardTitle>
            </CardHeader>
            <CardContent>Content area.</CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Connected", value: "3" },
            { label: "Total Sessions", value: "7" },
            { label: "Webhooks Active", value: "2" },
            { label: "Server Status", value: "Online" },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* AVATAR + TOOLTIP + DROPDOWN */}
      <Section title="Avatar · Tooltip · Dropdown">
        <div className="flex items-center gap-6">
          <Tooltip>
            <TooltipTrigger>
              <Avatar>
                <AvatarFallback>WA</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>Waqas Ahmed Waseer</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Section>

      {/* TABS */}
      <Section title="Tabs">
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">API Reference</TabsTrigger>
            <TabsTrigger value="tab2">Request Log</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="text-muted-foreground text-sm pt-2">API Reference tab content.</TabsContent>
          <TabsContent value="tab2" className="text-muted-foreground text-sm pt-2">Request Log tab content.</TabsContent>
        </Tabs>
      </Section>

      {/* DIALOG + SHEET */}
      <Section title="Dialog · Sheet">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="outline">Open Dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete session?</DialogTitle>
                <DialogDescription>
                  This will permanently delete the session and all its data. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger render={<Button variant="outline">Open Sheet</Button>} />
            <SheetContent>
              <SheetHeader>
                <SheetTitle>New Session</SheetTitle>
                <SheetDescription>Create a new WhatsApp session.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Session ID</Label>
                  <Input placeholder="my-session-1" />
                </div>
                <Button>Create Session</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Section>

      {/* SKELETONS */}
      <Section title="Skeleton Loaders">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </Section>

      {/* TABLE */}
      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_ROWS.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.id}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{row.since}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {/* TOAST */}
      <Section title="Toast (Sonner)">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast.success("Session created successfully!")}>
            Success toast
          </Button>
          <Button variant="outline" onClick={() => toast.error("Failed to connect to WA Server.")}>
            Error toast
          </Button>
          <Button variant="outline" onClick={() => toast.info("Webhook URL copied to clipboard.")}>
            Info toast
          </Button>
        </div>
      </Section>

      <Separator />
      <p className="text-xs text-muted-foreground text-center pb-8">
        Internal style guide — not visible in production nav.
      </p>
    </div>
  );
}
