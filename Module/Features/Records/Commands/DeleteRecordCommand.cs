using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.Services;

namespace Module.Features.Records.Commands;

public record DeleteRecordCommand(int ModuleId, int RecordId) : ICommand;

public class DeleteRecordHandler : IRequestHandler<DeleteRecordCommand>
{
    private readonly AppDbContext _context;
    private readonly IRelationService _relationService;

    public DeleteRecordHandler(AppDbContext context, IRelationService relationService)
    {
        _context = context;
        _relationService = relationService;
    }

    public async Task Handle(DeleteRecordCommand request, CancellationToken cancellationToken)
    {
        var record = await _context.ModuleRecords
            .Include(r => r.Module)
            .FirstOrDefaultAsync(r => r.Id == request.RecordId && r.ModuleId == request.ModuleId, cancellationToken);

        if (record == null)
        {
            throw new KeyNotFoundException($"Record with ID {request.RecordId} not found in module {request.ModuleId}.");
        }

        // Check for incoming relations (Referential Integrity)
        var hasIncomingRelations = await _context.RecordRelations
            .AnyAsync(r => r.TargetModule == record.Module.Name && r.TargetRecordId == record.Id, cancellationToken);

        if (hasIncomingRelations)
        {
            throw new InvalidOperationException("Cannot delete this record because it is referenced by other records (Referential Integrity).");
        }

        _context.ModuleRecords.Remove(record);
        await _context.SaveChangesAsync(cancellationToken);

        // Delete outgoing relations for source
        await _relationService.DeleteRelationsForSource(record.Module.Name, record.Id);
    }
}
