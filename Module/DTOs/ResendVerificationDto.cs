using System.ComponentModel.DataAnnotations;

namespace Module.DTOs;

public class ResendVerificationDto
{
    [Required(ErrorMessage = "E-posta adresi gereklidir")]
    [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi giriniz")]
    public string Email { get; set; } = string.Empty;
}
