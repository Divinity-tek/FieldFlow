const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendInvoiceRequest {
  to: string;
  from: string;
  clientName?: string;
  invoiceNumber: string;
  fileName: string;
  pdfBase64: string;
}

Deno.serve(async (req) => {
  // Handle browser CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const body = (await req.json()) as SendInvoiceRequest;

    const {
      to,
      from,
      clientName,
      invoiceNumber,
      fileName,
      pdfBase64,
    } = body;

    if (!to) {
      throw new Error("Client email is required");
    }

    if (!from) {
      throw new Error("Sender email is required");
    }

    if (!invoiceNumber) {
      throw new Error("Invoice number is required");
    }

    if (!fileName) {
      throw new Error("PDF file name is required");
    }

    if (!pdfBase64) {
      throw new Error("PDF data is required");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Invoice ${invoiceNumber}`,
        html: `
          <p>Hello${clientName ? ` ${clientName}` : ""},</p>

          <p>
            Please find attached invoice <strong>${invoiceNumber}</strong>.
          </p>

          <p>
            Thank you.
          </p>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBase64,
          },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", result);

      throw new Error(
        result?.message || "Failed to send invoice email"
      );
    }

    console.log(
      `Invoice ${invoiceNumber} sent successfully to ${to}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        emailId: result?.id ?? null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Send invoice error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send invoice",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});