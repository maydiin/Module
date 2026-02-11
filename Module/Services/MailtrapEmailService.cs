using System.Net;
using System.Net.Mail;

namespace Module.Services;

public class MailtrapEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<MailtrapEmailService> _logger;

    public MailtrapEmailService(IConfiguration configuration, ILogger<MailtrapEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendVerificationEmailAsync(string toEmail, string username, string verificationCode)
    {
        try
        {
            var smtpSection = _configuration.GetSection("Smtp");
            var host = smtpSection["Host"] ?? "live.smtp.mailtrap.io";
            var port = int.Parse(smtpSection["Port"] ?? "587");
            var apiToken = smtpSection["ApiToken"];
            var fromEmail = smtpSection["FromEmail"] ?? "hello@demomailtrap.co";
            var fromName = smtpSection["FromName"] ?? "Module System";

            if (string.IsNullOrEmpty(apiToken))
            {
                _logger.LogError("SMTP API token is not configured");
                throw new InvalidOperationException("SMTP API token is not configured");
            }

            var emailBody = $@"Merhaba {username},

Hesabınızı doğrulamak için aşağıdaki kodu kullanın:

Doğrulama Kodu: {verificationCode}

Bu kod 15 dakika geçerlidir.

Eğer bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.

İyi günler,
Module System";

            using var smtpClient = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential("api", apiToken),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail, fromName),
                Subject = "E-posta Doğrulama Kodu",
                Body = emailBody,
                IsBodyHtml = false
            };
            
            mailMessage.To.Add(toEmail);

            await smtpClient.SendMailAsync(mailMessage);

            _logger.LogInformation("Verification email sent successfully to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while sending verification email to {Email}", toEmail);
            throw;
        }
    }
}
