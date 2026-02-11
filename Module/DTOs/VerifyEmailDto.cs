using System.ComponentModel.DataAnnotations;

namespace Module.DTOs;

public class VerifyEmailDto
{
    [Required(ErrorMessage = "E-posta adresi gereklidir")]
    [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi giriniz")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Doğrulama kodu gereklidir")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "Doğrulama kodu 6 haneli olmalıdır")]
    public string VerificationCode { get; set; } = string.Empty;
}
